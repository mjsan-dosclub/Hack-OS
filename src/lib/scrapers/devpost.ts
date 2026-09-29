import { BaseScraper } from "./base.ts";
import { parseDevpostRss, parseEventListing } from "./html.ts";
import type { RawHackathonData } from "./types.ts";

const listingUrl = new URL("https://devpost.com/hackathons");

/** Devpost adapter: documented public RSS first, current public listing HTML second. */
export class DevpostScraper extends BaseScraper {
	readonly name = "devpost" as const;

	async scrape(): Promise<RawHackathonData[]> {
		const feedUrl = new URL("https://devpost.com/hackathons.rss");
		let feedRecords: RawHackathonData[] = [];
		try {
			const xml = await this.fetchText(
				feedUrl,
				"application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
			);
			feedRecords = parseDevpostRss(xml, feedUrl);
			this.parsed(feedRecords.length);
			if (feedRecords.length === 0) this.skipped(1);
		} catch (error: unknown) {
			this.failed();
			console.warn(
				JSON.stringify({
					level: "warn",
					source: this.name,
					event: "rss_fallback",
					detail: error instanceof Error ? error.message : "unknown error",
				}),
			);
		}
		try {
			const listingRecords = await this.fetchListingPages(
				listingUrl,
				(html, url) => parseEventListing(html, url, this.name),
			);
			const merged = new Map(
				listingRecords.map((record) => [record.sourceUrl, record]),
			);
			for (const feedRecord of feedRecords) {
				const listingRecord = merged.get(feedRecord.sourceUrl);
				merged.set(
					feedRecord.sourceUrl,
					listingRecord
						? {
								...feedRecord,
								...listingRecord,
								organizer: listingRecord.organizer ?? feedRecord.organizer,
								description:
									feedRecord.description ?? listingRecord.description,
								rawText: `${feedRecord.rawText} ${listingRecord.rawText}`.slice(
									0,
									10_000,
								),
								tags: [...new Set([...feedRecord.tags, ...listingRecord.tags])],
								tracks:
									listingRecord.tracks.length > 0
										? listingRecord.tracks
										: feedRecord.tracks,
							}
						: feedRecord,
				);
			}
			return [...merged.values()];
		} catch (error: unknown) {
			this.failed();
			throw error;
		}
	}
}
