import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseEventListing } from "../../src/lib/scrapers/html.ts";
import { sanitizeHackathon } from "../../src/lib/scrapers/sanitizer.ts";
import { scraperHackathonSchema } from "../../src/schemas/hackathon.ts";

const fixture = (name: string): string =>
	readFileSync(
		fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
		"utf8",
	);

describe("scraper normalization pipeline", () => {
	it("recovers a clean Devpost event from dirty HTML and rejects an insecure link", async () => {
		const raw = parseEventListing(
			fixture("devpost-dirty-listing.html"),
			new URL("https://devpost.com/hackathons"),
			"devpost",
		);

		expect(raw).toHaveLength(1);
		expect(raw[0]?.title).toBe("Campus Climate Build");
		expect(raw[0]?.sourceUrl).toBe(
			"https://devpost.com/hackathons/campus-climate-build",
		);

		const first = raw[0];
		expect(first).toBeDefined();
		if (!first)
			throw new Error("The Devpost fixture did not produce a record.");
		const result = await sanitizeHackathon(first);
		expect(result).not.toBeNull();
		const parsed = scraperHackathonSchema.safeParse(result);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.format).toBe("online");
			expect(parsed.data.totalPrizeValue).toBe(50_000);
			expect(parsed.data.verified).toBe(false);
		}
	});

	it("parses Devfolio JSON-LD with partial optional fields into the canonical insert schema", async () => {
		const jsonLd = z
			.record(z.string(), z.unknown())
			.parse(JSON.parse(fixture("devfolio-event.json")));
		const html = `<html><body><script type="application/ld+json">${JSON.stringify(jsonLd)}</script><script type="application/ld+json">{truncated</script></body></html>`;
		const raw = parseEventListing(
			html,
			new URL("https://devfolio.co/hackathons"),
			"devfolio",
		);

		expect(raw).toHaveLength(1);
		const first = raw[0];
		expect(first).toBeDefined();
		if (!first)
			throw new Error("The Devfolio fixture did not produce a record.");
		const result = await sanitizeHackathon(first);
		expect(result).not.toBeNull();
		const parsed = scraperHackathonSchema.safeParse(result);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.source).toBe("devfolio");
			expect(parsed.data.organizer).toBe("Devfolio Campus");
			expect(parsed.data.totalPrizeValue).toBe(25_000);
			expect(parsed.data.venueCountry).toBeNull();
		}
	});

	it("skips an event when its required dates are malformed and cannot be explicitly extracted", async () => {
		const malformed = {
			source: "devpost" as const,
			sourceId: "invalid-date",
			sourceUrl: "https://devpost.com/hackathons/invalid-date",
			title: "Broken Event",
			rawText: "Online prize pool INR 1000",
			startDateText: "not a date",
			endDateText: "not a date",
			formatHint: "online",
			tags: [],
			tracks: [],
		};

		await expect(sanitizeHackathon(malformed)).resolves.toBeNull();
	});
});
