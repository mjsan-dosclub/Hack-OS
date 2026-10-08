import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { hackathonSourceChecks, hackathons } from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import {
	adminDeleteIdsSchema,
	approvedEventsListSchema,
	approvedEventsQuerySchema,
	reviewActionSchema,
	reviewListSchema,
} from "@/schemas/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
	if (error instanceof MemberAccessError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: error.status },
		);
	}
	console.error("[event-review] Request failed.");
	return NextResponse.json(
		{ error: "Event review is unavailable." },
		{ status: 500 },
	);
}

/** Only the admin session can read the unpublished moderation queue. */
export async function GET(request: Request) {
	try {
		await requireAdminMember();
		const db = getDatabase();
		const url = new URL(request.url);
		if (url.searchParams.get("view") === "approved") {
			const query = approvedEventsQuerySchema.safeParse({
				page: url.searchParams.get("page") ?? undefined,
				pageSize: url.searchParams.get("pageSize") ?? undefined,
				search: url.searchParams.get("search") ?? "",
				status: url.searchParams.get("status") ?? "all",
				format: url.searchParams.get("format") ?? "all",
			});
			if (!query.success)
				return NextResponse.json(
					{ error: "Invalid event list filters." },
					{ status: 400 },
				);
			const { page, pageSize, search, status, format } = query.data;
			const filters = [
				eq(hackathons.published, true),
				eq(hackathons.verified, true),
			];
			if (search) {
				const matchingSearch = or(
					ilike(hackathons.title, `%${search}%`),
					ilike(hackathons.organizer, `%${search}%`),
					ilike(hackathons.venueCity, `%${search}%`),
				);
				if (matchingSearch) filters.push(matchingSearch);
			}
			if (status !== "all")
				filters.push(eq(hackathons.applicationStatus, status));
			if (format !== "all") filters.push(eq(hackathons.format, format));
			const where = and(...filters);
			const [rows, totals] = await Promise.all([
				db
					.select({
						id: hackathons.id,
						title: hackathons.title,
						description: hackathons.description,
						organizer: hackathons.organizer,
						websiteUrl: hackathons.websiteUrl,
						bannerUrl: hackathons.bannerUrl,
						format: hackathons.format,
						venueCity: hackathons.venueCity,
						venueCountry: hackathons.venueCountry,
						startDate: hackathons.startDate,
						endDate: hackathons.endDate,
						registrationDeadline: hackathons.registrationDeadline,
						applicationStatus: hackathons.applicationStatus,
						prizeCurrency: hackathons.prizeCurrency,
						totalPrizeValue: hackathons.totalPrizeValue,
						source: hackathons.source,
					})
					.from(hackathons)
					.where(where)
					.orderBy(desc(hackathons.startDate), asc(hackathons.title))
					.limit(pageSize)
					.offset((page - 1) * pageSize),
				db.select({ value: count() }).from(hackathons).where(where),
			]);
			const parsed = approvedEventsListSchema.safeParse({
				events: rows.map((row) => ({
					...row,
					startDate: row.startDate.toISOString(),
					endDate: row.endDate.toISOString(),
					registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
				})),
				page,
				pageSize,
				total: totals[0]?.value ?? 0,
			});
			if (!parsed.success) throw new Error("Invalid approved event data.");
			return NextResponse.json(parsed.data);
		}
		const rows = await db
			.select({
				id: hackathons.id,
				title: hackathons.title,
				description: hackathons.description,
				organizer: hackathons.organizer,
				websiteUrl: hackathons.websiteUrl,
				bannerUrl: hackathons.bannerUrl,
				format: hackathons.format,
				venueCity: hackathons.venueCity,
				venueCountry: hackathons.venueCountry,
				startDate: hackathons.startDate,
				endDate: hackathons.endDate,
				registrationDeadline: hackathons.registrationDeadline,
				applicationStatus: hackathons.applicationStatus,
				prizeCurrency: hackathons.prizeCurrency,
				totalPrizeValue: hackathons.totalPrizeValue,
				source: hackathons.source,
				verified: hackathons.verified,
				published: hackathons.published,
			})
			.from(hackathons)
			.where(
				or(eq(hackathons.published, false), eq(hackathons.verified, false)),
			)
			.orderBy(asc(hackathons.verified), desc(hackathons.updatedAt))
			.limit(100);
		const checks = rows.length
			? await db
					.select({
						hackathonId: hackathonSourceChecks.hackathonId,
						provider: hackathonSourceChecks.provider,
						sourceUrl: hackathonSourceChecks.sourceUrl,
						checkStatus: hackathonSourceChecks.checkStatus,
						observedAt: hackathonSourceChecks.observedAt,
					})
					.from(hackathonSourceChecks)
					.where(
						inArray(
							hackathonSourceChecks.hackathonId,
							rows.map((row) => row.id),
						),
					)
					.orderBy(desc(hackathonSourceChecks.observedAt))
					.limit(300)
			: [];
		const parsed = reviewListSchema.safeParse({
			events: rows.map((row) => ({
				...row,
				startDate: row.startDate.toISOString(),
				endDate: row.endDate.toISOString(),
				registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
				evidence: checks
					.filter((check) => check.hackathonId === row.id)
					.map((check) => ({
						provider: check.provider,
						sourceUrl: check.sourceUrl,
						checkStatus: check.checkStatus,
						observedAt: check.observedAt.toISOString(),
					})),
			})),
		});
		if (!parsed.success) throw new Error("Invalid review data.");
		return NextResponse.json(parsed.data);
	} catch (error: unknown) {
		return failure(error);
	}
}

/** Saving an edit pauses publication; approving explicitly publishes the reviewed details. */
export async function POST(request: Request) {
	try {
		await requireAdminMember();
		if (request.headers.get("origin") !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		const length = Number(request.headers.get("content-length") ?? 0);
		if (length > 60_000)
			return NextResponse.json(
				{ error: "Review data is too large." },
				{ status: 413 },
			);
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{ error: "Send valid review data." },
				{ status: 400 },
			);
		}
		const parsed = reviewActionSchema.safeParse(body);
		if (!parsed.success)
			return NextResponse.json(
				{ error: "Check the event fields and dates." },
				{ status: 400 },
			);
		const db = getDatabase();
		if (parsed.data.action === "create") {
			const event = parsed.data.event;
			const baseSlug =
				event.title
					.toLowerCase()
					.normalize("NFKD")
					.replace(/[\u0300-\u036f]/g, "")
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "")
					.slice(0, 160) || "hackathon";
			const suffix = crypto.randomUUID().slice(0, 8);
			const [created] = await db
				.insert(hackathons)
				.values({
					slug: `${baseSlug}-${suffix}`,
					title: event.title,
					description: event.description,
					organizer: event.organizer,
					websiteUrl: event.websiteUrl,
					bannerUrl: event.bannerUrl,
					format: event.format,
					venueCity: event.venueCity,
					venueCountry: event.venueCountry,
					startDate: new Date(event.startDate),
					endDate: new Date(event.endDate),
					registrationDeadline: event.registrationDeadline
						? new Date(event.registrationDeadline)
						: null,
					applicationStatus: event.applicationStatus,
					prizeCurrency: event.prizeCurrency,
					totalPrizeValue: event.totalPrizeValue,
					source: "manual",
					verified: false,
					published: false,
				})
				.returning({ id: hackathons.id });
			if (!created)
				return NextResponse.json(
					{ error: "The manual event could not be added." },
					{ status: 500 },
				);
			return NextResponse.json(
				{ status: "created_for_review", id: created.id },
				{ status: 201 },
			);
		}
		const id =
			parsed.data.action === "hide" ? parsed.data.id : parsed.data.event.id;
		const [existing] = await db
			.select({
				id: hackathons.id,
				venueCity: hackathons.venueCity,
				venueCountry: hackathons.venueCountry,
			})
			.from(hackathons)
			.where(eq(hackathons.id, id))
			.limit(1);
		if (!existing)
			return NextResponse.json({ error: "Event not found." }, { status: 404 });
		if (parsed.data.action === "update") {
			const [publishedEvent] = await db
				.select({ id: hackathons.id })
				.from(hackathons)
				.where(
					and(
						eq(hackathons.id, id),
						eq(hackathons.published, true),
						eq(hackathons.verified, true),
					),
				)
				.limit(1);
			if (!publishedEvent)
				return NextResponse.json(
					{
						error:
							"This event is no longer published. Refresh the list and review it in the moderation queue.",
					},
					{ status: 409 },
				);
		}
		if (parsed.data.action === "hide") {
			await db
				.update(hackathons)
				.set({ published: false, verified: false })
				.where(eq(hackathons.id, id));
			return NextResponse.json({ status: "hidden" });
		}
		const { event, action } = parsed.data;
		const locationChanged =
			event.venueCity !== existing.venueCity ||
			event.venueCountry !== existing.venueCountry;
		await db
			.update(hackathons)
			.set({
				title: event.title,
				description: event.description,
				organizer: event.organizer,
				websiteUrl: event.websiteUrl,
				bannerUrl: event.bannerUrl,
				format: event.format,
				venueCity: event.venueCity,
				venueCountry: event.venueCountry,
				...(locationChanged ? { latitude: null, longitude: null } : {}),
				startDate: new Date(event.startDate),
				endDate: new Date(event.endDate),
				registrationDeadline: event.registrationDeadline
					? new Date(event.registrationDeadline)
					: null,
				applicationStatus: event.applicationStatus,
				prizeCurrency: event.prizeCurrency,
				totalPrizeValue: event.totalPrizeValue,
				published: action === "approve" || action === "update",
				verified: action === "approve" || action === "update",
			})
			.where(eq(hackathons.id, id));
		return NextResponse.json({
			status:
				action === "approve" || action === "update"
					? "published"
					: "saved_for_review",
		});
	} catch (error: unknown) {
		return failure(error);
	}
}

/** Delete explicitly selected published events; related saved/event records follow their FK rules. */
export async function DELETE(request: Request) {
	try {
		await requireAdminMember();
		if (request.headers.get("origin") !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		const body: unknown = await request.json().catch(() => null);
		const parsed = adminDeleteIdsSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Select between 1 and 100 unique events." },
				{ status: 400 },
			);
		}
		const deleted = await getDatabase()
			.delete(hackathons)
			.where(
				and(
					eq(hackathons.published, true),
					eq(hackathons.verified, true),
					inArray(hackathons.id, parsed.data.ids),
				),
			)
			.returning({ id: hackathons.id });
		return NextResponse.json({ deletedCount: deleted.length });
	} catch (error: unknown) {
		return failure(error);
	}
}
