import { BaseScraper } from "./base.ts";
import { parseEventListing } from "./html.ts";
import type { RawHackathonData } from "./types.ts";

// Unstop's public human-readable listing currently resolves on its api subdomain.
const listingUrl = new URL("https://api.unstop.com/hackathons/");

/** Unstop adapter reads public collegiate event cards and keeps raw eligibility text. */
export class UnstopScraper extends BaseScraper {
	readonly name = "unstop" as const;

	async scrape(): Promise<RawHackathonData[]> {
		try {
			const records = await this.fetchListingPages(listingUrl, (html, url) =>
				parseEventListing(html, url, this.name),
			);
			return await this.enrichEventDetails(records);
		} catch (error: unknown) {
			this.failed();
			throw error;
		}
	}
}
