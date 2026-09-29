import { describe, expect, it } from "vitest";
import { ideaEvaluationSchema } from "../../src/schemas/copilot.ts";

const validEvaluation = {
	overallScore: 78,
	breakdown: {
		originality: {
			score: 8,
			rationale: "The concept has a clear local focus.",
		},
		trackRelevance: {
			score: 7,
			matchedTrack: "Climate Action",
			rationale: "The event record lists this track.",
		},
		technicalFeasibility: {
			score: 8,
			bottleneckRisks: ["Keep the first data import small."],
		},
		demoImpact: {
			score: 8,
			pitchAdvice: "Show a before-and-after user journey.",
		},
	},
	strengths: ["The demo has a clear user outcome."],
	criticalWeaknesses: ["The data source needs validation."],
	pivotSuggestions: ["Start with one verified dataset and show its source."],
};

describe("ideaEvaluationSchema", () => {
	it("parses the complete structured evaluator result", () => {
		expect(ideaEvaluationSchema.parse(validEvaluation)).toEqual(
			validEvaluation,
		);
	});

	it("rejects out-of-range scores, missing rationale, and unexpected fields", () => {
		const malformed = {
			...validEvaluation,
			breakdown: {
				...validEvaluation.breakdown,
				originality: { score: 11, rationale: "Outside the rubric range." },
			},
			inventedWinningPrediction: "This team is guaranteed to win.",
		};

		expect(ideaEvaluationSchema.safeParse(malformed).success).toBe(false);
	});
});
