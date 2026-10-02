import { streamText } from "ai";
import {
	createJarvisModel,
	jarvisErrorResponse,
	logJarvisFailure,
} from "@/lib/ai/jarvisGateway";
import {
	COPILOT_SYSTEM_PROMPT,
	MODE_PROMPTS,
	summarizeHackathonContext,
	summarizeTeam,
} from "@/lib/copilot/prompts";
import type { CopilotMode } from "@/schemas/copilot";
import { copilotChatRequestSchema } from "@/schemas/copilot";

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

	let model: ReturnType<typeof createJarvisModel>;
	try {
		model = createJarvisModel();
	} catch (error: unknown) {
		logJarvisFailure("copilot.chat", error);
		return jarvisErrorResponse(error);
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
	try {
		const result = streamText({
			model,
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
						provider: "jarvislabs",
						mode,
						latencyMs: Date.now() - requestStartedAt,
					}),
				);
			},
			onFinish: ({ totalUsage }) => {
				console.info(
					JSON.stringify({
						event: "copilot_stream_complete",
						provider: "jarvislabs",
						mode,
						latencyMs: Date.now() - requestStartedAt,
						outputTokens: totalUsage.outputTokens,
					}),
				);
			},
			onError: ({ error }) => logJarvisFailure("copilot.chat", error),
		});
		// Return the HTTP stream immediately. Waiting for the model's first token
		// here can exceed Vercel Edge's response-start deadline and surface as 504.
		return result.toTextStreamResponse({
			headers: {
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"X-AI-Provider": "jarvislabs",
			},
		});
	} catch (error: unknown) {
		if (request.signal.aborted) return new Response(null, { status: 499 });
		logJarvisFailure("copilot.chat", error);
		return jarvisErrorResponse(error);
	}
}
