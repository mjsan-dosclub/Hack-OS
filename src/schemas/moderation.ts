import { z } from "zod";

const webUrl = z
	.string()
	.url()
	.refine((value) => value.startsWith("https://"), {
		message: "Use an HTTPS official event URL.",
	});
const dateTime = z.string().datetime({ offset: true });

const reviewEventFieldsSchema = z
	.object({
		title: z.string().trim().min(3).max(240),
		description: z.string().trim().max(50_000),
		organizer: z.string().trim().min(2).max(180),
		websiteUrl: webUrl,
		bannerUrl: z
			.string()
			.url()
			.refine((value) => value.startsWith("https://"), {
				message: "Use an HTTPS banner URL.",
			})
			.nullable(),
		format: z.enum(["online", "in-person", "hybrid"]),
		venueCity: z.string().trim().max(120).nullable(),
		venueCountry: z.string().trim().max(120).nullable(),
		startDate: dateTime,
		endDate: dateTime,
		registrationDeadline: dateTime.nullable(),
		applicationStatus: z.enum(["upcoming", "open", "closed", "ended"]),
		prizeCurrency: z.string().regex(/^[A-Z]{3}$/),
		totalPrizeValue: z.number().int().nonnegative(),
	})
	.strict();

function validateReviewInvariants(
	value: {
		startDate: string;
		endDate: string;
		format: "online" | "in-person" | "hybrid";
		venueCountry: string | null;
	},
	context: z.RefinementCtx,
) {
	if (Date.parse(value.endDate) < Date.parse(value.startDate)) {
		context.addIssue({
			code: "custom",
			path: ["endDate"],
			message: "End date must follow start date.",
		});
	}
	if (value.format !== "online" && !value.venueCountry) {
		context.addIssue({
			code: "custom",
			path: ["venueCountry"],
			message: "Physical events need a country.",
		});
	}
}

export const reviewEventSchema = reviewEventFieldsSchema
	.extend({ id: z.string().uuid() })
	.superRefine(validateReviewInvariants);
export const manualEventSchema = reviewEventFieldsSchema.superRefine(
	validateReviewInvariants,
);
export const bulkManualEventsSchema = z
	.array(manualEventSchema)
	.min(1)
	.max(500);
export const bulkManualEventsResultSchema = z
	.object({
		added: z.number().int().nonnegative(),
		duplicatesSkipped: z.number().int().nonnegative(),
		issueCount: z.number().int().nonnegative(),
		issues: z.array(
			z
				.object({
					rowNumber: z.number().int().positive(),
					messages: z.array(z.string().min(1)),
					values: z
						.object({
							title: z.string(),
							organizer: z.string(),
							official_url: z.string(),
							description: z.string(),
							banner_url: z.string(),
							format: z.string(),
							venue_city: z.string(),
							venue_country: z.string(),
							start_date: z.string(),
							end_date: z.string(),
							registration_deadline: z.string(),
							application_status: z.string(),
							prize_currency: z.string(),
							total_prize_value: z.string(),
						})
						.strict(),
				})
				.strict(),
		),
	})
	.strict();

export const reviewActionSchema = z.discriminatedUnion("action", [
	z
		.object({ action: z.enum(["save", "approve"]), event: reviewEventSchema })
		.strict(),
	z.object({ action: z.literal("create"), event: manualEventSchema }).strict(),
	z.object({ action: z.literal("hide"), id: z.string().uuid() }).strict(),
]);

export const manualCreateResultSchema = z
	.object({ status: z.literal("created_for_review"), id: z.string().uuid() })
	.strict();

const evidenceSchema = z
	.object({
		provider: z.string(),
		sourceUrl: z
			.string()
			.url()
			.refine((value) => /^https?:\/\//i.test(value)),
		checkStatus: z.enum(["confirmed", "conflict", "unmatched"]),
		observedAt: dateTime,
	})
	.strict();

export const reviewListSchema = z
	.object({
		events: z.array(
			z
				.object({
					...reviewEventSchema.innerType().shape,
					source: z.enum(["devpost", "devfolio", "unstop", "manual", "mlh"]),
					verified: z.boolean(),
					published: z.boolean(),
					evidence: z.array(evidenceSchema),
				})
				.strict(),
		),
	})
	.strict();

export const approvedEventsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(50).default(20),
	search: z.string().trim().max(120).default(""),
	status: z.enum(["all", "open", "upcoming", "closed", "ended"]).default("all"),
	format: z.enum(["all", "online", "in-person", "hybrid"]).default("all"),
});

export const approvedEventsListSchema = z.object({
	events: z.array(
		z.object({
			id: z.string().uuid(),
			title: z.string(),
			organizer: z.string(),
			websiteUrl: z.string().url(),
			format: z.enum(["online", "in-person", "hybrid"]),
			venueCity: z.string().nullable(),
			venueCountry: z.string().nullable(),
			startDate: dateTime,
			endDate: dateTime,
			registrationDeadline: dateTime.nullable(),
			applicationStatus: z.enum(["upcoming", "open", "closed", "ended"]),
			source: z.enum(["devpost", "devfolio", "unstop", "manual", "mlh"]),
		}),
	),
	page: z.number().int().min(1),
	pageSize: z.number().int().min(1),
	total: z.number().int().min(0),
});

export type ApprovedEvent = z.infer<
	typeof approvedEventsListSchema
>["events"][number];

export type ReviewEvent = z.infer<typeof reviewListSchema>["events"][number];
