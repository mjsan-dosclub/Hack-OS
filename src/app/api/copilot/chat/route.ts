import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { APICallError, streamText } from "ai";
import {
	COPILOT_SYSTEM_PROMPT,
	MODE_PROMPTS,
	summarizeHackathonContext,
	summarizeTeam,
} from "@/lib/copilot/prompts";
import type { CopilotMode } from "@/schemas/copilot";
import { copilotChatRequestSchema } from "@/schemas/copilot";
import { jarvisLabsConfigSchema } from "@/schemas/ideator";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Keep completion time bounded. Architecture gets the largest budget because it
// must include a diagram and concrete API/data contracts.
const MAX_OUTPUT_TOKENS: Record<CopilotMode, number> = {
	brainstorm: 900,
	architecture: 1_800,
	evaluate: 900,
	sprint: 1_000,
};

type ProviderName = "jarvislabs";
interface ProviderModel {
	name: ProviderName;
	model: LanguageModel;
}

function providerModels(): ProviderModel[] {
	const jarvisConfig = jarvisLabsConfigSchema.safeParse({
		apiKey: process.env.JARVISLABS_API_KEY,
		baseURL: process.env.JARVISLABS_BASE_URL,
		model: process.env.JARVISLABS_MODEL,
	});

	if (!jarvisConfig.success) return [];
	const jarvis = createOpenAI({
		baseURL: jarvisConfig.data.baseURL,
		apiKey: jarvisConfig.data.apiKey,
	});
	return [{ name: "jarvislabs", model: jarvis(jarvisConfig.data.model) }];
}

function redactSecrets(message: string): string {
	let safeMessage = message;
	const secret = process.env.JARVISLABS_API_KEY;
	if (secret) safeMessage = safeMessage.replaceAll(secret, "[REDACTED]");
	return safeMessage.slice(0, 500);
}

function providerStatusCode(error: unknown): number | null {
	if (APICallError.isInstance(error) && error.statusCode !== undefined)
		return error.statusCode;
	if (!(error instanceof Error)) return null;
	const match = error.message.match(/status_code.{0,5}(\d{3})/i);
	return match?.[1] ? Number(match[1]) : null;
}

function logProviderFailure(provider: ProviderName, error: unknown): void {
	const detail =
		error instanceof Error ? error.message : "Unknown provider error.";
	console.error(
		JSON.stringify({
			event: "copilot_provider_error",
			provider,
			statusCode: providerStatusCode(error),
			detail: redactSecrets(detail),
		}),
	);
}

function providerFailureResponse(error: unknown): Response {
	const statusCode = providerStatusCode(error);
	if (statusCode === 401 || statusCode === 403) {
		return Response.json(
			{ error: "JarvisLabs rejected its server-side API key." },
			{ status: 502 },
		);
	}
	if (
		statusCode === 408 ||
		statusCode === 429 ||
		(statusCode !== null && statusCode >= 500)
	) {
		return Response.json(
			{
				error:
					"The JarvisLabs Ollama endpoint is temporarily busy. Please retry shortly.",
			},
			{ status: 503 },
		);
	}
	return Response.json(
		{ error: "JarvisLabs Ollama could not generate a response. Please retry." },
		{ status: 502 },
	);
}

export async function POST(request: Request): Promise<Response> {
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return Response.json(
			{ error: "Request body must be valid JSON." },
			{ status: 400 },
		);
	}
	const parsed = copilotChatRequestSchema.safeParse(input);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid Co-Pilot request." },
			{ status: 400 },
		);
	}

	const models = providerModels();
	if (models.length === 0) {
		return Response.json(
			{
				error:
					"Configure JARVISLABS_API_KEY, JARVISLABS_BASE_URL, and JARVISLABS_MODEL to enable the Co-Pilot.",
			},
			{ status: 503 },
		);
	}

	const { mode, context, team, messages } = parsed.data;
	const requestStartedAt = Date.now();
	let firstTokenLogged = false;
	const system = [
		COPILOT_SYSTEM_PROMPT,
		`Current task mode: ${mode}.\n${MODE_PROMPTS[mode]}`,
		`Trusted event facts from the validated directory schema:\n${summarizeHackathonContext(context)}`,
		`Team constraints supplied by the student:\n${summarizeTeam(team)}`,
	].join("\n\n");
	let lastError: unknown;

	for (const candidate of models) {
		try {
			const result = streamText({
				model: candidate.model,
				system,
				messages,
				abortSignal: request.signal,
				maxOutputTokens: MAX_OUTPUT_TOKENS[mode],
				maxRetries: 0,
				temperature: 0.5,
				onChunk: ({ chunk }) => {
					if (firstTokenLogged || chunk.type !== "text-delta") return;
					firstTokenLogged = true;
					console.info(
						JSON.stringify({
							event: "copilot_first_token",
							provider: candidate.name,
							mode,
							latencyMs: Date.now() - requestStartedAt,
						}),
					);
				},
				onFinish: ({ totalUsage }) => {
					console.info(
						JSON.stringify({
							event: "copilot_stream_complete",
							provider: candidate.name,
							mode,
							latencyMs: Date.now() - requestStartedAt,
							outputTokens: totalUsage.outputTokens,
						}),
					);
				},
				onError: ({ error }) => logProviderFailure(candidate.name, error),
			});
			// Return the HTTP stream immediately. Waiting for the model's first token
			// here can exceed Vercel Edge's response-start deadline and surface as 504.
			return result.toTextStreamResponse({
				headers: {
					"Cache-Control": "no-store",
					"X-Content-Type-Options": "nosniff",
					"X-AI-Provider": candidate.name,
				},
			});
		} catch (error: unknown) {
			if (request.signal.aborted) return new Response(null, { status: 499 });
			lastError = error;
			logProviderFailure(candidate.name, error);
		}
	}

	return providerFailureResponse(
		lastError ?? new Error("No configured AI provider completed the request."),
	);
}
