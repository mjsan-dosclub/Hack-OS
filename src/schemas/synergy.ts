import { z } from "zod";

const cleanStringList = z
	.array(z.string().trim().min(1).max(80))
	.max(20)
	.transform((values) => [...new Set(values)]);

/** Only student-authored profile fields are accepted from the browser. */
export const studentHackathonRequestInputSchema = z
	.object({
		fieldOfInterest: z.string().trim().min(2).max(180),
		studentSkills: cleanStringList,
		techComfort: cleanStringList,
		rolesSought: cleanStringList,
		concerns: z.string().trim().max(800).default(""),
		contributionSummary: z.string().trim().min(8).max(800),
		locationCity: z.string().trim().max(120).nullable(),
		travelFlexibility: z.enum(["remote_only", "regional", "anywhere"]),
		allowAiMatching: z.boolean().default(false),
		allowProfileForAiMatching: z.boolean().default(false),
	})
	.strict();

export const synergyProjectSchema = z
	.object({
		title: z.string().min(1),
		techStack: z.array(z.string()),
		link: z.string().url().nullable(),
	})
	.strict();

export const synergyMemberSchema = z
	.object({
		id: z.string().uuid(),
		fullName: z.string().min(1),
		membershipStatus: z.enum(["current", "alumnus", "mentor"]),
		primarySkills: z.array(z.string()),
		interests: z.array(z.string()),
		locationCity: z.string().nullable(),
		canTravel: z.boolean(),
		githubUrl: z.string().url().nullable(),
		linkedinUrl: z.string().url().nullable(),
		recentProjects: z.array(synergyProjectSchema),
		matchReason: z.string().min(1),
	})
	.strict();

export const synergyHackathonSchema = z
	.object({
		id: z.string().uuid(),
		slug: z.string(),
		title: z.string(),
		organizer: z.string(),
		websiteUrl: z.string().url(),
		format: z.enum(["online", "in-person", "hybrid"]),
		venueCity: z.string().nullable(),
		venueCountry: z.string().nullable(),
		startDate: z.string().datetime(),
		endDate: z.string().datetime(),
		registrationDeadline: z.string().datetime().nullable(),
		applicationStatus: z.enum(["upcoming", "open"]),
		prizeCurrency: z.string().length(3),
		totalPrizeValue: z.number().int().nonnegative(),
		tags: z.array(z.string()),
		matchScore: z.number().int().min(0).max(100),
		matchReason: z.string().min(1),
	})
	.strict();

export const synergyMatchResponseSchema = z
	.object({
		requestId: z.string().uuid(),
		hackathons: z.array(synergyHackathonSchema).max(10),
		teammates: z.array(synergyMemberSchema).max(3),
		mentor: synergyMemberSchema.nullable(),
		assessment: z
			.object({
				available: z.boolean(),
				usedForMatching: z.boolean(),
				note: z.string(),
			})
			.strict(),
		recommendationSource: z.enum(["jarvislabs", "rules"]),
		generatedAt: z.string().datetime(),
	})
	.strict();

/** JarvisLabs may only choose opaque keys from the server-provided shortlist. */
export const synergyAiSelectionSchema = z
	.object({
		teammates: z
			.array(
				z
					.object({
						candidateKey: z.string().regex(/^C[0-9]{1,2}$/),
						reason: z.string().trim().min(10).max(300),
					})
					.strict(),
			)
			.max(3),
		mentor: z
			.object({
				candidateKey: z.string().regex(/^M[0-9]{1,2}$/),
				reason: z.string().trim().min(10).max(300),
			})
			.strict()
			.nullable(),
	})
	.strict();

export type StudentHackathonRequestInput = z.infer<
	typeof studentHackathonRequestInputSchema
>;
export type SynergyMatchResponse = z.infer<typeof synergyMatchResponseSchema>;
