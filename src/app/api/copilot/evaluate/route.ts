import { generateObject } from "ai";
import {
	createJarvisModel,
	jarvisErrorResponse,
	logJarvisFailure,
} from "@/lib/ai/jarvisGateway";
import {
	COPILOT_SYSTEM_PROMPT,
	summarizeHackathonContext,
	summarizeTeam,
} from "@/lib/copilot/prompts";
import {
	ideaEvaluationRequestSchema,
	ideaEvaluationSchema,
} from "@/schemas/copilot";

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
	const { pitch, context, team } = parsed.data;
	const grounding = summarizeHackathonContext(context);
	const prompt = `Evaluate this exact student pitch without rewriting its claims:\n\n${pitch}\n\nValidated event context:\n${grounding}\n\nTeam capacity:\n${summarizeTeam(team)}\n\nScore originality, track relevance, feasibility in the stated hours, and demo impact. Refer only to tracks listed in the event context. If no track is listed, set matchedTrack to "No track supplied" and explain that uncertainty. Do not predict that the team will win. Make weaknesses and pivots specific to this pitch. Return at least one strength.`;
	try {
		const result = await generateObject({
			model: createJarvisModel(),
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
		logJarvisFailure("copilot.evaluate", error);
		return jarvisErrorResponse(error);
	}
}
