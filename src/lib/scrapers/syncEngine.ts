import { and, eq, notInArray } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import {
	hackathonTagLinks,
	hackathonTags,
	hackathonTracks,
	hackathons,
} from "../../db/schema.ts";
import type { HackathonInsert } from "../../schemas/hackathon.ts";
import type { RawHackathonData, ScraperName } from "./types.ts";
import { DevfolioScraper } from "./devfolio.ts";
import { DevpostScraper } from "./devpost.ts";
import { UnstopScraper } from "./unstop.ts";
import { sanitizeHackathon } from "./sanitizer.ts";

export interface SyncSummary {
	source: ScraperName;
	scanned: number;
	inserted: number;
	updated: number;
	skipped: number;
	errors: string[];
}

const scrapers = {
	devpost: () => new DevpostScraper(),
	devfolio: () => new DevfolioScraper(),
	unstop: () => new UnstopScraper(),
} satisfies Record<
	ScraperName,
	() => { scrape(): Promise<import("./types.ts").RawHackathonData[]> }
>;

/** A source run is sequential, validated, and safe to repeat; one bad record does not abort its peers. */
export async function syncSource(source: ScraperName): Promise<SyncSummary> {
	const scraper = scrapers[source]();
	const summary: SyncSummary = {
		source,
		scanned: 0,
		inserted: 0,
		updated: 0,
		skipped: 0,
		errors: [],
	};
	let records: RawHackathonData[];
	try {
		records = await scraper.scrape();
	} catch (error: unknown) {
		summary.errors.push(
			error instanceof Error
				? error.message
				: "Scraper failed with an unknown error.",
		);
		return summary;
	}
	summary.scanned = records.length;

	for (const raw of records) {
		try {
			const record = await sanitizeHackathon(raw);
			if (!record) {
				summary.skipped += 1;
				continue;
			}
			const result = await upsertHackathon(record);
			if (result === "inserted") summary.inserted += 1;
			else summary.updated += 1;
		} catch (error: unknown) {
			summary.errors.push(
				`${raw.sourceId}: ${error instanceof Error ? error.message : "record failed validation or database write"}`,
			);
		}
	}
	console.info(
		JSON.stringify({
			level: "info",
			event: "source_sync_complete",
			...summary,
		}),
	);
	return summary;
}

async function upsertHackathon(
	record: HackathonInsert,
): Promise<"inserted" | "updated"> {
	return getDatabase().transaction(async (tx) => {
		const [existing] = await tx
			.select({
				id: hackathons.id,
				verified: hackathons.verified,
				published: hackathons.published,
			})
			.from(hackathons)
			.where(
				and(
					eq(hackathons.source, record.source),
					eq(hackathons.sourceId, record.sourceId ?? ""),
				),
			)
			.limit(1);

		const coordinates = record.coordinates ?? null;
		const values = {
			slug: record.slug,
			title: record.title,
			description: record.description,
			eligibilityRules: record.eligibilityRules,
			submissionGuidelines: record.submissionGuidelines,
			organizer: record.organizer,
			websiteUrl: record.websiteUrl,
			bannerUrl: record.bannerUrl ?? null,
			format: record.format,
			venueCity: record.venueCity ?? null,
			venueCountry: record.venueCountry ?? null,
			latitude: coordinates?.latitude ?? null,
			longitude: coordinates?.longitude ?? null,
			prizeCurrency: record.prizeCurrency,
			totalPrizeValue: record.totalPrizeValue,
			startDate: new Date(record.startDate),
			endDate: new Date(record.endDate),
			registrationDeadline: record.registrationDeadline
				? new Date(record.registrationDeadline)
				: null,
			applicationStatus: record.applicationStatus,
			source: record.source,
			sourceId: record.sourceId ?? null,
			verified: false,
			published: false,
		};

		const [saved] = await tx
			.insert(hackathons)
			.values(values)
			.onConflictDoUpdate({
				target: [hackathons.source, hackathons.sourceId],
				// Preserve moderator decisions made after first ingestion.
				set: {
					...values,
					verified: existing?.verified ?? false,
					published: existing?.published ?? false,
					updatedAt: new Date(),
				},
			})
			.returning({ id: hackathons.id });
		if (!saved)
			throw new Error("Database did not return the upserted hackathon.");

		// Tracks are replaced as one transaction so removed source tracks do not linger.
		if (record.tracks.length > 0) {
			await tx
				.delete(hackathonTracks)
				.where(eq(hackathonTracks.hackathonId, saved.id));
			await tx
				.insert(hackathonTracks)
				.values(
					record.tracks.map((track) => ({ ...track, hackathonId: saved.id })),
				);
		}

		const tagIds: string[] = [];
		for (const slug of record.tags) {
			const label = slug
				.split("-")
				.map((part) =>
					part ? part.charAt(0).toUpperCase() + part.slice(1) : "",
				)
				.join(" ");
			const [tag] = await tx
				.insert(hackathonTags)
				.values({ slug, name: label })
				.onConflictDoUpdate({
					target: hackathonTags.slug,
					set: { name: label, updatedAt: new Date() },
				})
				.returning({ id: hackathonTags.id });
			if (!tag) throw new Error(`Unable to resolve tag ${slug}.`);
			tagIds.push(tag.id);
			await tx
				.insert(hackathonTagLinks)
				.values({ hackathonId: saved.id, tagId: tag.id })
				.onConflictDoNothing();
		}
		if (tagIds.length > 0) {
			await tx
				.delete(hackathonTagLinks)
				.where(
					and(
						eq(hackathonTagLinks.hackathonId, saved.id),
						notInArray(hackathonTagLinks.tagId, tagIds),
					),
				);
		}
		return existing ? "updated" : "inserted";
	});
}

export async function syncSources(
	sources: readonly ScraperName[],
): Promise<SyncSummary[]> {
	const summaries: SyncSummary[] = [];
	for (const source of sources) summaries.push(await syncSource(source));
	return summaries;
}
