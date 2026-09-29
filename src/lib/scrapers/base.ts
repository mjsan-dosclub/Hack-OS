import type {
	RawHackathonData,
	ScraperLogger,
	ScraperMetrics,
	ScraperName,
} from "./types.ts";
import { scraperLogger } from "./types.ts";
import { findNextListingPage, parseEventDetailPage } from "./html.ts";

const USER_AGENT =
	"DeScienceHackOS/1.0 (+https://descienceosclub.com; student hackathon directory)";

export class ScraperError extends Error {
	readonly source: ScraperName;
	constructor(source: ScraperName, message: string, options?: ErrorOptions) {
		super(`[${source}] ${message}`, options);
		this.name = "ScraperError";
		this.source = source;
	}
}

/** Shared polite fetch, retry and structured metrics behavior for all adapters. */
export abstract class BaseScraper {
	abstract readonly name: ScraperName;
	readonly metrics: ScraperMetrics = { parsed: 0, failed: 0, skipped: 0 };
	private readonly logger: ScraperLogger;

	constructor(logger: ScraperLogger = scraperLogger) {
		this.logger = logger;
	}

	abstract scrape(): Promise<RawHackathonData[]>;

	protected async fetchText(url: URL, accept: string): Promise<string> {
		await this.politeDelay();
		let lastError: unknown;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			try {
				const response = await fetch(url, {
					headers: { "User-Agent": USER_AGENT, Accept: accept },
					redirect: "follow",
					signal: AbortSignal.timeout(20_000),
					cache: "no-store",
				});
				if (response.ok) return await response.text();
				if (response.status < 500 && response.status !== 429) {
					throw new ScraperError(
						this.name,
						`upstream returned HTTP ${response.status} for ${url.origin}${url.pathname}`,
					);
				}
				lastError = new Error(`HTTP ${response.status}`);
			} catch (error: unknown) {
				if (error instanceof ScraperError) throw error;
				lastError = error;
			}
			if (attempt < 2)
				await new Promise<void>((resolve) =>
					setTimeout(resolve, 1_000 * 2 ** attempt),
				);
		}
		throw new ScraperError(
			this.name,
			`request failed after retries for ${url.origin}${url.pathname}`,
			{ cause: lastError },
		);
	}

	protected async fetchListingPages(
		startUrl: URL,
		parsePage: (html: string, url: URL) => RawHackathonData[],
		maxPages = 5,
	): Promise<RawHackathonData[]> {
		const collected = new Map<string, RawHackathonData>();
		const visited = new Set<string>();
		let pageUrl: URL | null = startUrl;
		while (pageUrl && visited.size < maxPages) {
			const currentUrl = pageUrl;
			if (visited.has(currentUrl.href)) break;
			visited.add(currentUrl.href);
			const html = await this.fetchText(
				currentUrl,
				"text/html, application/xhtml+xml;q=0.9",
			);
			for (const event of parsePage(html, currentUrl))
				collected.set(event.sourceId, event);
			pageUrl = findNextListingPage(html, currentUrl);
		}
		const records = [...collected.values()];
		this.parsed(records.length);
		if (records.length === 0) this.skipped(1);
		return records;
	}

	/** Fetches linked detail pages only when the listing omits dates or venue facts. */
	protected async enrichEventDetails(
		records: RawHackathonData[],
		maxDetails = 40,
	): Promise<RawHackathonData[]> {
		const enriched: RawHackathonData[] = [];
		let requests = 0;
		for (const record of records) {
			const needsDetails =
				!record.startDateText ||
				!record.endDateText ||
				!record.venueText ||
				!record.prizeText;
			if (!needsDetails || requests >= maxDetails) {
				enriched.push(record);
				continue;
			}
			requests += 1;
			try {
				const pageUrl = new URL(record.sourceUrl);
				const html = await this.fetchText(
					pageUrl,
					"text/html, application/xhtml+xml;q=0.9",
				);
				const detail = parseEventDetailPage(html, pageUrl, this.name);
				enriched.push({
					...record,
					title: record.title || detail.title,
					organizer: detail.organizer ?? record.organizer,
					description: detail.description ?? record.description,
					eligibilityRules: detail.eligibilityRules ?? record.eligibilityRules,
					submissionGuidelines:
						detail.submissionGuidelines ?? record.submissionGuidelines,
					rawText: `${record.rawText} ${detail.rawText}`
						.replace(/\s+/g, " ")
						.trim()
						.slice(0, 10_000),
					bannerUrl: record.bannerUrl ?? detail.bannerUrl,
					venueText: detail.venueText ?? record.venueText,
					formatHint: record.formatHint ?? detail.formatHint,
					startDateText: detail.startDateText ?? record.startDateText,
					endDateText: detail.endDateText ?? record.endDateText,
					registrationDeadlineText:
						detail.registrationDeadlineText ?? record.registrationDeadlineText,
					prizeText: detail.prizeText ?? record.prizeText,
					tags: [...new Set([...record.tags, ...detail.tags])],
					tracks: detail.tracks.length > 0 ? detail.tracks : record.tracks,
				});
			} catch (error: unknown) {
				this.failed();
				this.logger.record("event_detail_unavailable", {
					source: this.name,
					sourceId: record.sourceId,
					detail:
						error instanceof Error
							? error.message.slice(0, 300)
							: "unknown error",
				});
				enriched.push(record);
			}
		}
		if (records.length > maxDetails) this.skipped(records.length - maxDetails);
		return enriched;
	}

	protected parsed(count: number): void {
		this.metrics.parsed += count;
		this.logMetrics();
	}

	protected failed(count = 1): void {
		this.metrics.failed += count;
		this.logMetrics();
	}

	protected skipped(count = 1): void {
		this.metrics.skipped += count;
		this.logMetrics();
	}

	protected logMetrics(): void {
		this.logger.record("scraper_metrics", {
			source: this.name,
			parsed: this.metrics.parsed,
			failed: this.metrics.failed,
			skipped: this.metrics.skipped,
		});
	}

	private async politeDelay(): Promise<void> {
		// Spread load between 1 and 2 seconds even when several adapters run together.
		await new Promise<void>((resolve) =>
			setTimeout(resolve, 1_000 + Math.floor(Math.random() * 1_001)),
		);
	}
}
