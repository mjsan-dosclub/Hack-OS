import { z } from "zod";
import { hackathonDisplaySchema } from "./hackathon.ts";

export const COPILOT_MODES = [
	"brainstorm",
	"architecture",
	"evaluate",
	"sprint",
] as const;
export const copilotModeSchema = z.enum(COPILOT_MODES);

export const teamProfileSchema = z
	.object({
		memberCount: z.number().int().min(1).max(8),
		skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
		skills: z.array(z.string().trim().min(1).max(48)).max(12),
		preferredTechStack: z.string().trim().max(240),
		availableHours: z.number().int().min(4).max(168),
	})
	.strict();

export const copilotMessageSchema = z
	.object({
		role: z.enum(["user", "assistant"]),
		content: z.string().trim().min(1).max(8_000),
	})
	.strict();

export const copilotChatRequestSchema = z
	.object({
		mode: copilotModeSchema,
		context: hackathonDisplaySchema.nullable(),
		team: teamProfileSchema,
		messages: z.array(copilotMessageSchema).min(1).max(8),
	})
	.strict();

const scoreSchema = z.number().int().min(1).max(10);
export const ideaEvaluationSchema = z
	.object({
		overallScore: z.number().int().min(1).max(100),
		breakdown: z
			.object({
				originality: z
					.object({
						score: scoreSchema,
						rationale: z.string().trim().min(1).max(1200),
					})
					.strict(),
				trackRelevance: z
					.object({
						score: scoreSchema,
						matchedTrack: z.string().trim().min(1).max(240),
						rationale: z.string().trim().min(1).max(1200),
					})
					.strict(),
				technicalFeasibility: z
					.object({
						score: scoreSchema,
						bottleneckRisks: z.array(z.string().trim().min(1).max(400)).max(8),
					})
					.strict(),
				demoImpact: z
					.object({
						score: scoreSchema,
						pitchAdvice: z.string().trim().min(1).max(1200),
					})
					.strict(),
			})
			.strict(),
		strengths: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
		criticalWeaknesses: z.array(z.string().trim().min(1).max(500)).max(8),
		pivotSuggestions: z.array(z.string().trim().min(1).max(800)).max(8),
	})
	.strict();

export const ideaEvaluationRequestSchema = z
	.object({
		pitch: z.string().trim().min(20).max(6_000),
		context: hackathonDisplaySchema.nullable(),
		team: teamProfileSchema,
	})
	.strict();

export type CopilotMode = z.infer<typeof copilotModeSchema>;
export type CopilotMessage = z.infer<typeof copilotMessageSchema>;
export type TeamProfile = z.infer<typeof teamProfileSchema>;
export type IdeaEvaluation = z.infer<typeof ideaEvaluationSchema>;
