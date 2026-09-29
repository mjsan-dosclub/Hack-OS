import { z } from "zod";

export const ideaRequestSchema = z
	.object({
		brief: z
			.string()
			.trim()
			.min(12, "Add a little more detail about what you want to build.")
			.max(1200),
		audience: z.string().trim().max(180).optional(),
		focus: z
			.enum(["open-source", "ai", "climate", "accessibility", "student-life"])
			.default("open-source"),
	})
	.strict();

export const ideaResponseSchema = z
	.object({
		idea: z.string().trim().min(80).max(12000),
		provider: z.literal("jarvislabs"),
	})
	.strict();

/** Server-only connection settings for a JarvisLabs OpenAI-compatible endpoint. */
export const jarvisLabsConfigSchema = z
	.object({
		apiKey: z.string().trim().min(1),
		baseURL: z
			.string()
			.trim()
			.url()
			.refine(
				(value) => new URL(value).protocol === "https:",
				"JarvisLabs endpoint must use HTTPS.",
			),
		model: z.string().trim().min(1).max(120),
	})
	.strict();

export type IdeaRequest = z.infer<typeof ideaRequestSchema>;
export type IdeaResponse = z.infer<typeof ideaResponseSchema>;
