import { z } from "zod";

/** Private aggregate shape returned by the protected admin overview endpoint. */
export const adminSummarySchema = z
	.object({
		events: z
			.object({
				total: z.number().int().nonnegative(),
				upcoming: z.number().int().nonnegative(),
				open: z.number().int().nonnegative(),
				closed: z.number().int().nonnegative(),
				ended: z.number().int().nonnegative(),
			})
			.strict(),
		categories: z
			.array(
				z
					.object({ name: z.string(), total: z.number().int().nonnegative() })
					.strict(),
			)
			.max(12),
		locations: z
			.array(
				z
					.object({ name: z.string(), total: z.number().int().nonnegative() })
					.strict(),
			)
			.max(12),
		colleges: z
			.array(
				z
					.object({ name: z.string(), total: z.number().int().nonnegative() })
					.strict(),
			)
			.max(12),
		members: z
			.object({
				total: z.number().int().nonnegative(),
				verified: z.number().int().nonnegative(),
				current: z.number().int().nonnegative(),
				alumni: z.number().int().nonnegative(),
				mentors: z.number().int().nonnegative(),
			})
			.strict(),
		activity: z
			.object({
				teammateMatches: z.number().int().nonnegative(),
				projectPlans: z.number().int().nonnegative(),
				topMembers: z
					.array(
						z
							.object({
								userId: z.string().uuid(),
								name: z.string(),
								email: z.string().email(),
								teammateMatches: z.number().int().nonnegative(),
								projectPlans: z.number().int().nonnegative(),
								lastUsedAt: z.string().datetime().nullable(),
							})
							.strict(),
					)
					.max(25),
			})
			.strict(),
	})
	.strict();

export type AdminSummary = z.infer<typeof adminSummarySchema>;
