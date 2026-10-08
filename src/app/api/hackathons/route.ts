import { and, asc, eq, gt, gte, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import {
	hackathons,
	hackathonTracks,
	hackathonTags,
	hackathonTagLinks,
} from "@/db/schema";
import { hackathonDisplaySchema } from "@/schemas/hackathon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseSchema = z
	.object({ events: z.array(hackathonDisplaySchema).max(250) })
	.strict();

/** Public desktop data: the same approval and availability gate as Synergy. */
export async function GET() {
	try {
		const db = getDatabase();
		const now = new Date();
		const rows = await db
			.select()
			.from(hackathons)
			.where(
				and(
					eq(hackathons.published, true),
					eq(hackathons.verified, true),
					inArray(hackathons.applicationStatus, ["open", "upcoming"]),
					gte(hackathons.endDate, now),
					or(
						isNull(hackathons.registrationDeadline),
						gt(hackathons.registrationDeadline, now),
					),
				),
			)
			.orderBy(asc(hackathons.registrationDeadline), asc(hackathons.startDate))
			.limit(250);
		const ids = rows.map((row) => row.id);
		const [tracks, tags] = ids.length
			? await Promise.all([
					db
						.select()
						.from(hackathonTracks)
						.where(inArray(hackathonTracks.hackathonId, ids)),
					db
						.select({
							hackathonId: hackathonTagLinks.hackathonId,
							id: hackathonTags.id,
							slug: hackathonTags.slug,
							name: hackathonTags.name,
						})
						.from(hackathonTagLinks)
						.innerJoin(
							hackathonTags,
							eq(hackathonTagLinks.tagId, hackathonTags.id),
						)
						.where(inArray(hackathonTagLinks.hackathonId, ids)),
				])
			: [[], []];
		const result = responseSchema.safeParse({
			events: rows.map((row) => ({
				id: row.id,
				slug: row.slug,
				title: row.title,
				description: row.description,
				eligibilityRules: row.eligibilityRules,
				submissionGuidelines: row.submissionGuidelines,
				organizer: row.organizer,
				websiteUrl: row.websiteUrl,
				bannerUrl: row.bannerUrl,
				format: row.format,
				venueCity: row.venueCity,
				venueCountry: row.venueCountry,
				coordinates:
					row.latitude !== null && row.longitude !== null
						? { latitude: row.latitude, longitude: row.longitude }
						: null,
				prizeCurrency: row.prizeCurrency,
				totalPrizeValue: row.totalPrizeValue,
				startDate: row.startDate.toISOString(),
				endDate: row.endDate.toISOString(),
				registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
				applicationStatus: row.applicationStatus,
				source: row.source,
				verified: row.verified,
				createdAt: row.createdAt.toISOString(),
				tracks: tracks
					.filter((track) => track.hackathonId === row.id)
					.map((track) => ({
						id: track.id,
						title: track.title,
						description: track.description,
						prizeAmount: track.prizeAmount,
					})),
				tags: tags
					.filter((tag) => tag.hackathonId === row.id)
					.map((tag) => ({ id: tag.id, slug: tag.slug, name: tag.name })),
			})),
		});
		if (!result.success)
			throw new Error(
				"Published event data did not satisfy the shared contract.",
			);
		return NextResponse.json(result.data, {
			headers: {
				// Event records can be edited by moderators; serve the latest verified
				// values instead of letting an edge cache mask an admin correction.
				"Cache-Control": "private, no-store, max-age=0, must-revalidate",
				"Vercel-CDN-Cache-Control": "no-store",
			},
		});
	} catch {
		console.error("[public-events] Unable to read verified events.");
		return NextResponse.json(
			{ error: "Verified events are unavailable." },
			{ status: 503 },
		);
	}
}
