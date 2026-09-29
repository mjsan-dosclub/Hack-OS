import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
	ideaEvaluationRequestSchema,
	ideaEvaluationSchema,
} from "@/schemas/copilot";
import {
	COPILOT_SYSTEM_PROMPT,
	summarizeHackathonContext,
	summarizeTeam,
} from "@/lib/copilot/prompts";
import { jarvisLabsConfigSchema } from "@/schemas/ideator";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function calculateOverallScore(breakdown: {
	originality: { score: number };
	trackRelevance: { score: number };
	technicalFeasibility: { score: number };
	demoImpact: { score: number };
}): number {
	// Fixed weighting makes the final 1–100 score reproducible from validated rubric scores.
	const weighted =
		breakdown.originality.score * 0.2 +
		breakdown.trackRelevance.score * 0.3 +
		breakdown.technicalFeasibility.score * 0.3 +
		breakdown.demoImpact.score * 0.2;
	return Math.round(weighted * 10);
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
	const parsed = ideaEvaluationRequestSchema.safeParse(input);
	if (!parsed.success) {
		return Response.json(
			{
				error: parsed.error.issues[0]?.message ?? "Invalid evaluation request.",
			},
			{ status: 400 },
		);
	}
	const config = jarvisLabsConfigSchema.safeParse({
		apiKey: process.env.JARVISLABS_API_KEY,
		baseURL: process.env.JARVISLABS_BASE_URL,
		model: process.env.JARVISLABS_MODEL,
	});
	if (!config.success) {
		return Response.json(
			{
				error:
					"Configure JARVISLABS_API_KEY, JARVISLABS_BASE_URL, and JARVISLABS_MODEL to use the structured evaluator.",
			},
			{ status: 503 },
		);
	}

	const { pitch, context, team } = parsed.data;
	const grounding = summarizeHackathonContext(context);
	const prompt = `Evaluate this exact student pitch without rewriting its claims:\n\n${pitch}\n\nValidated event context:\n${grounding}\n\nTeam capacity:\n${summarizeTeam(team)}\n\nScore originality, track relevance, feasibility in the stated hours, and demo impact. Refer only to tracks listed in the event context. If no track is listed, set matchedTrack to "No track supplied" and explain that uncertainty. Do not predict that the team will win. Make weaknesses and pivots specific to this pitch. Return at least one strength.`;
	const jarvis = createOpenAI({
		baseURL: config.data.baseURL,
		apiKey: config.data.apiKey,
	});

	try {
		const result = await generateObject({
			model: jarvis(config.data.model),
			schema: ideaEvaluationSchema,
			system: `${COPILOT_SYSTEM_PROMPT}\n\nAct as a consistent rubric evaluator. Scores must be integers from 1 to 10.`,
			prompt,
			abortSignal: request.signal,
			maxRetries: 0,
			temperature: 0,
		});
		const output = ideaEvaluationSchema.parse({
			...result.object,
			overallScore: calculateOverallScore(result.object.breakdown),
		});
		return Response.json(output, { headers: { "Cache-Control": "no-store" } });
	} catch (error: unknown) {
		const detail =
			error instanceof Error
				? error.message
				: "Unknown structured-output error.";
		console.error(
			JSON.stringify({
				event: "copilot_evaluation_error",
				detail: detail.slice(0, 500),
			}),
		);
		return Response.json(
			{
				error:
					"The evaluator could not complete a validated score. Please retry.",
			},
			{ status: 502 },
		);
	}
}
