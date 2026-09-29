import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { APICallError, streamText } from "ai";
import {
	COPILOT_SYSTEM_PROMPT,
	MODE_PROMPTS,
	summarizeHackathonContext,
	summarizeTeam,
} from "@/lib/copilot/prompts";
import { copilotChatRequestSchema } from "@/schemas/copilot";
import { jarvisLabsConfigSchema } from "@/schemas/ideator";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

function logProviderFailure(provider: ProviderName, error: unknown): void {
	const detail =
		error instanceof Error ? error.message : "Unknown provider error.";
	console.error(
		JSON.stringify({
			event: "copilot_provider_error",
			provider,
			statusCode: APICallError.isInstance(error) ? error.statusCode : null,
			detail: redactSecrets(detail),
		}),
	);
}

function providerFailureResponse(error: unknown): Response {
	if (
		APICallError.isInstance(error) &&
		(error.statusCode === 401 || error.statusCode === 403)
	) {
		return Response.json(
			{ error: "JarvisLabs rejected its server-side API key." },
			{ status: 502 },
		);
	}
	if (
		APICallError.isInstance(error) &&
		(error.statusCode === 408 ||
			error.statusCode === 429 ||
			(error.statusCode !== undefined && error.statusCode >= 500))
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
				maxOutputTokens: 3_500,
				maxRetries: 0,
				temperature: 0.5,
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
