import { z } from "zod";
import {
	APPLICATION_STATUSES,
	CASH_PRIZE_STATUSES,
	HACKATHON_FORMATS,
	HACKATHON_SOURCES,
	HACKATHON_REWARD_CATEGORIES,
} from "../types/hackathon.ts";

const urlSchema = z
	.string()
	.url()
	.refine(
		(value) => /^https?:\/\//i.test(value),
		"URL must use HTTP or HTTPS.",
	);
const dateSchema = z.string().datetime({ offset: true });

export const coordinatesSchema = z
	.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
	})
	.strict();

export const hackathonTrackSchema = z
	.object({
		id: z.string().uuid(),
		title: z.string().trim().min(1).max(180),
		description: z.string().max(10_000),
		prizeAmount: z.number().int().nonnegative(),
	})
	.strict();

export const hackathonTagSchema = z
	.object({
		id: z.string().uuid(),
		slug: z
			.string()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
			.max(64),
		name: z.string().trim().min(1).max(80),
	})
	.strict();

export const hackathonRewardSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().trim().min(1).max(180),
		category: z.enum(HACKATHON_REWARD_CATEGORIES),
		recipient: z.string().trim().min(1).max(100),
		details: z.string().max(2_000),
		amount: z.number().nonnegative().nullable(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.nullable(),
		sourceExcerpt: z.string().max(2_000),
		sourceUrl: urlSchema,
	})
	.strict();

export const hackathonRewardInputSchema = hackathonRewardSchema
	.extend({ id: z.string().uuid().optional() })
	.superRefine((reward, context) => {
		if ((reward.amount === null) !== (reward.currency === null)) {
			context.addIssue({
				code: "custom",
				path: ["amount"],
				message: "Provide both an amount and currency, or neither.",
			});
		}
		if (reward.category !== "cash" && reward.amount !== null) {
			context.addIssue({
				code: "custom",
				path: ["amount"],
				message: "Only cash rewards can have a monetary amount.",
			});
		}
	});

const hackathonInsertBaseSchema = z
	.object({
		slug: z
			.string()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
			.max(180),
		title: z.string().trim().min(1).max(240),
		description: z.string().max(50_000).default(""),
		eligibilityRules: z
			.string()
			.max(10_000)
			.default("Eligibility details have not been published."),
		submissionGuidelines: z
			.string()
			.max(10_000)
			.default("Check the official event page for submission requirements."),
		organizer: z.string().trim().min(1).max(180),
		websiteUrl: urlSchema,
		bannerUrl: urlSchema.nullable().optional(),
		format: z.enum(HACKATHON_FORMATS),
		venueCity: z.string().max(120).nullable().optional(),
		venueCountry: z.string().max(120).nullable().optional(),
		coordinates: coordinatesSchema.nullable().optional(),
		prizeCurrency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.default("USD"),
		totalPrizeValue: z.number().int().nonnegative().default(0),
		cashPrizeStatus: z.enum(CASH_PRIZE_STATUSES).default("unannounced"),
		goodiesAvailable: z.boolean().default(false),
		rewards: z.array(hackathonRewardInputSchema).max(40).default([]),
		startDate: dateSchema,
		endDate: dateSchema,
		registrationDeadline: dateSchema.nullable().optional(),
		applicationStatus: z.enum(APPLICATION_STATUSES).default("upcoming"),
		source: z.enum(HACKATHON_SOURCES),
		sourceId: z.string().max(240).nullable().optional(),
		verified: z.boolean().default(false),
		published: z.boolean().default(false),
		tracks: z
			.array(
				z
					.object({
						title: z.string().trim().min(1).max(180),
						description: z.string().max(10_000).default(""),
						prizeAmount: z.number().int().nonnegative().default(0),
					})
					.strict(),
			)
			.default([]),
		tags: z
			.array(
				z
					.string()
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
					.max(64),
			)
			.default([]),
	})
	.strict();

export const hackathonInsertSchema = hackathonInsertBaseSchema.superRefine(
	(value, context) => {
		if (Date.parse(value.endDate) < Date.parse(value.startDate)) {
			context.addIssue({
				code: "custom",
				path: ["endDate"],
				message: "End date must be on or after start date.",
			});
		}
	},
);

export const hackathonDisplaySchema = z
	.object({
		id: z.string().uuid(),
		createdAt: dateSchema,
		...hackathonInsertBaseSchema.omit({
			tracks: true,
			tags: true,
			sourceId: true,
			published: true,
		}).shape,
		bannerUrl: urlSchema.nullable(),
		venueCity: z.string().nullable(),
		venueCountry: z.string().nullable(),
		coordinates: coordinatesSchema.nullable(),
		registrationDeadline: dateSchema.nullable(),
		verified: z.boolean(),
		tracks: z.array(hackathonTrackSchema),
		tags: z.array(hackathonTagSchema),
		rewards: z.array(hackathonRewardSchema).default([]),
	})
	.strict();

// Parsers reject unrecognized upstream fields; provider adapters map their
// payloads into this canonical data contract before writing to the database.
export const scraperHackathonSchema = hackathonInsertSchema;

export type HackathonInsert = z.infer<typeof hackathonInsertSchema>;
export type HackathonDisplay = z.infer<typeof hackathonDisplaySchema>;
