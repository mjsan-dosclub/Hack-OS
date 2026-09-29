import { BaseScraper } from "./base.ts";
import { parseEventListing } from "./html.ts";
import type { RawHackathonData } from "./types.ts";

const listingUrl = new URL("https://devfolio.co/hackathons");

/** Devfolio adapter intentionally uses its public HTML instead of undocumented APIs. */
export class DevfolioScraper extends BaseScraper {
	readonly name = "devfolio" as const;

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
