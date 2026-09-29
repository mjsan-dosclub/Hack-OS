import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";
import { getDatabase } from "../../db/client.ts";
import { hackathonSourceChecks, hackathons } from "../../db/schema.ts";

export const VERIFICATION_PROVIDERS = [
	"hackodds",
	"hackathonradar",
	"hackclub",
	"hackamaps",
] as const;
export type VerificationProvider = (typeof VERIFICATION_PROVIDERS)[number];

interface ProviderConfig {
	readonly url: string;
	readonly label: string;
}
const PROVIDERS: Record<VerificationProvider, ProviderConfig> = {
	hackodds: {
		url: "https://hackodds-live.vercel.app/board",
		label: "HackOdds",
	},
	hackathonradar: {
		url: "https://www.hackathonradar.com/database",
		label: "Hackathon Radar",
	},
	hackclub: { url: "https://hackathons.hackclub.com/", label: "Hack Club" },
	hackamaps: { url: "https://hackamaps.com/", label: "HackaMaps" },
};

interface Observation {
	provider: VerificationProvider;
	sourceUrl: string;
	title: string;
	format: "online" | "in-person" | "hybrid" | null;
	startDate: Date | null;
	endDate: Date | null;
	venueCity: string | null;
	venueCountry: string | null;
	prizeCurrency: string | null;
	totalPrizeValue: number | null;
}

interface EventRow {
	id: string;
	title: string;
	websiteUrl: string;
	startDate: Date;
	endDate: Date;
	format: "online" | "in-person" | "hybrid";
	venueCity: string | null;
	venueCountry: string | null;
	prizeCurrency: string;
	totalPrizeValue: number;
}

export interface ProviderCheckSummary {
	provider: VerificationProvider;
	discovered: number;
	matched: number;
	confirmed: number;
	conflicts: number;
	unmatched: number;
	error: string | null;
}

function clean(value: string | undefined): string | null {
	const normalized = value?.replace(/\s+/g, " ").trim();
	return normalized ? normalized.slice(0, 2_000) : null;
}

function parseDate(
	value: string | undefined,
	defaultYear: string | undefined,
): Date | null {
	if (!value) return null;
	const normalized =
		/\b20\d{2}\b/.test(value) || !defaultYear
			? value
			: `${value} ${defaultYear}`;
	const date = new Date(normalized);
	return Number.isNaN(date.valueOf()) ? null : date;
}

function parsePrize(text: string): {
	currency: string | null;
	amount: number | null;
} {
	const match =
		text.match(
			/(₹|\$|€|£|INR|USD|EUR|GBP)\s*([\d,]+(?:\.\d+)?)(\s*[kKmM])?/i,
		) ?? text.match(/([\d,]+(?:\.\d+)?)\s*(INR|USD|EUR|GBP)\b/i);
	if (!match) return { currency: null, amount: null };
	const isCodeFirst = /^(?:₹|\$|€|£|INR|USD|EUR|GBP)$/i.test(match[1] ?? "");
	const marker = isCodeFirst ? match[1] : match[2];
	const numberText = isCodeFirst ? match[2] : match[1];
	const suffix = isCodeFirst ? match[3] : undefined;
	const currency =
		marker === "₹"
			? "INR"
			: marker === "$"
				? "USD"
				: marker === "€"
					? "EUR"
					: marker === "£"
						? "GBP"
						: (marker?.toUpperCase() ?? null);
	const base = Number(numberText?.replaceAll(",", ""));
	const multiplier =
		suffix?.trim().toLowerCase() === "k"
			? 1_000
			: suffix?.trim().toLowerCase() === "m"
				? 1_000_000
				: 1;
	return {
		currency,
		amount: Number.isFinite(base) ? Math.round(base * multiplier) : null,
	};
}

function titleSimilarity(left: string, right: string): number {
	const words = (value: string): Set<string> =>
		new Set(
			value
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, " ")
				.trim()
				.split(/\s+/)
				.filter((word) => word.length > 2),
		);
	const a = words(left);
	const b = words(right);
	if (!a.size || !b.size) return 0;
	let common = 0;
	for (const word of a) if (b.has(word)) common += 1;
	return (2 * common) / (a.size + b.size);
}

function normalizedUrl(value: string): string {
	try {
		const url = new URL(value);
		url.hash = "";
		url.search = "";
		return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
	} catch {
		return value.toLowerCase();
	}
}

/** Extracts visible public cards and their linked event pages; no undocumented API calls. */
function parseObservations(
	html: string,
	pageUrl: URL,
	provider: VerificationProvider,
): Observation[] {
	const $ = cheerio.load(html);
	const observations: Observation[] = [];
	const seen = new Set<string>();
	const listingYear = $("body")
		.text()
		.match(/20\d{2}/)?.[0];
	$("a[href]").each((_index, element) => {
		const anchor = $(element);
		const href = anchor.attr("href");
		if (!href) return;
		let link: URL;
		try {
			link = new URL(href, pageUrl);
		} catch {
			return;
		}
		if (link.protocol !== "https:" || seen.has(link.href)) return;
		const eventPath =
			provider === "hackodds"
				? /^\/hackathons\/[^/]+\/[^/]+\/?$/.test(link.pathname)
				: provider === "hackathonradar"
					? /^\/database\/hackathon\/[^/]+\/?$/.test(link.pathname)
					: provider === "hackclub"
						? link.hostname !== pageUrl.hostname &&
							!/list-of-hackathons/i.test(link.pathname)
						: false;
		if (!eventPath) return;
		const card = anchor.closest(
			"article, li, [class*='card' i], [data-testid*='card' i], .row",
		);
		const scope = card.length ? card : anchor;
		const text = clean(scope.text()) ?? "";
		const dateLabel =
			/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:\s*[-–—]\s*\d{1,2})?(?:,?\s+20\d{2})?\b/i.test(
				text,
			);
		const timeLabel = scope.find("time[datetime]").length > 0;
		if (
			provider === "hackclub" &&
			(!/(online|virtual|in[- ]person|hybrid)/i.test(text) ||
				(!dateLabel && !timeLabel))
		)
			return;
		let title =
			clean(scope.find("h1,h2,h3,h4,[class*='title' i]").first().text()) ??
			clean(anchor.attr("aria-label")) ??
			clean(anchor.text());
		if (provider === "hackclub" && title) {
			const label = title.replace(/^(online|hybrid|in[- ]person)\s*/i, "");
			title =
				clean(
					label.match(
						/^(.*?)(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b/i,
					)?.[1],
				) ?? label;
		}
		if (!title || title.length < 5 || title.length > 240 || text.length < 12)
			return;
		seen.add(link.href);
		const times = scope
			.find("time[datetime]")
			.map((_i, time) => $(time).attr("datetime") ?? "")
			.get();
		const dates =
			text.match(
				/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/gi,
			) ?? [];
		const location = clean(
			scope
				.find(
					"[class*='location' i], [class*='venue' i], [data-testid*='location' i]",
				)
				.first()
				.text(),
		);
		// Some cards render neighboring spans without whitespace (e.g. "devpostOnline").
		const eventFormat = /hybrid/i.test(text)
			? "hybrid"
			: /in[- ]?person|offline/i.test(text)
				? "in-person"
				: /online|virtual|remote/i.test(text)
					? "online"
					: null;
		const eventCountry = /India/i.test(`${location ?? ""} ${text}`)
			? "India"
			: null;
		// Keep the student's supported scope: online globally and in-person/hybrid only in India.
		if (eventFormat !== "online" && eventCountry !== "India") return;
		const prize = parsePrize(text);
		observations.push({
			provider,
			sourceUrl: link.href,
			title,
			format: eventFormat,
			startDate: parseDate(times[0] ?? dates[0], listingYear),
			endDate: parseDate(times[1] ?? dates[1], listingYear),
			venueCity:
				`${location ?? ""} ${text}`.match(
					/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*,\s*India\b/,
				)?.[1] ?? null,
			venueCountry: eventCountry,
			prizeCurrency: prize.currency,
			totalPrizeValue: prize.amount,
		});
	});
	return observations;
}

function inSupportedScope(event: EventRow): boolean {
	// The directory serves online events globally and in-person events in India only.
	return (
		event.format === "online" || /^(india|in)$/i.test(event.venueCountry ?? "")
	);
}

function factsFor(
	observation: Observation,
	event: EventRow,
): { score: number; agreed: string[]; conflict: boolean } {
	const agreed: string[] = [];
	let conflict = false;
	const compareDate = (
		name: string,
		observed: Date | null,
		canonical: Date,
	): void => {
		if (!observed) return;
		if (Math.abs(observed.valueOf() - canonical.valueOf()) <= 86_400_000)
			agreed.push(name);
		else conflict = true;
	};
	if (observation.format) {
		if (observation.format === event.format) agreed.push("format");
		else conflict = true;
	}
	compareDate("startDate", observation.startDate, event.startDate);
	compareDate("endDate", observation.endDate, event.endDate);
	if (observation.venueCity) {
		if (
			event.venueCity &&
			observation.venueCity.toLowerCase() === event.venueCity.toLowerCase()
		)
			agreed.push("venueCity");
		else if (event.venueCity) conflict = true;
	}
	if (observation.venueCountry) {
		if (
			event.venueCountry &&
			observation.venueCountry.toLowerCase() ===
				event.venueCountry.toLowerCase()
		)
			agreed.push("venueCountry");
		else if (event.venueCountry) conflict = true;
	}
	if (observation.prizeCurrency && observation.totalPrizeValue !== null) {
		if (
			observation.prizeCurrency === event.prizeCurrency &&
			observation.totalPrizeValue === event.totalPrizeValue
		)
			agreed.push("prize");
		else conflict = true;
	}
	const urlMatch =
		normalizedUrl(observation.sourceUrl) === normalizedUrl(event.websiteUrl);
	const score = Math.min(
		100,
		Math.round(
			(urlMatch
				? 75
				: 35 + 65 * titleSimilarity(observation.title, event.title)) +
				Math.min(20, agreed.length * 5),
		),
	);
	return { score, agreed, conflict };
}

/** Fetches public aggregator pages, records matches and disagreements, and never mutates canonical events. */
export async function verifyWithAggregators(): Promise<ProviderCheckSummary[]> {
	const db = getDatabase();
	const events = await db
		.select({
			id: hackathons.id,
			title: hackathons.title,
			websiteUrl: hackathons.websiteUrl,
			startDate: hackathons.startDate,
			endDate: hackathons.endDate,
			format: hackathons.format,
			venueCity: hackathons.venueCity,
			venueCountry: hackathons.venueCountry,
			prizeCurrency: hackathons.prizeCurrency,
			totalPrizeValue: hackathons.totalPrizeValue,
		})
		.from(hackathons)
		.where(eq(hackathons.published, true));
	const summaries: ProviderCheckSummary[] = [];
	for (const provider of VERIFICATION_PROVIDERS) {
		const summary: ProviderCheckSummary = {
			provider,
			discovered: 0,
			matched: 0,
			confirmed: 0,
			conflicts: 0,
			unmatched: 0,
			error: null,
		};
		try {
			const page = new URL(PROVIDERS[provider].url);
			const response = await fetch(page, {
				headers: {
					"User-Agent":
						"DeScienceHackOS/1.0 (+https://descienceosclub.com; public cross-check)",
					Accept: "text/html",
				},
				signal: AbortSignal.timeout(20_000),
				cache: "no-store",
				redirect: "follow",
			});
			if (!response.ok)
				throw new Error(`public page returned HTTP ${response.status}`);
			const html = await response.text();
			const observations = parseObservations(html, page, provider);
			summary.discovered = observations.length;
			for (const observation of observations) {
				const eligible = events.filter((event) => inSupportedScope(event));
				const ranked = eligible
					.map((event) => ({
						event,
						score: titleSimilarity(observation.title, event.title),
						urlMatch:
							normalizedUrl(observation.sourceUrl) ===
							normalizedUrl(event.websiteUrl),
					}))
					.sort(
						(a, b) =>
							Number(b.urlMatch) - Number(a.urlMatch) || b.score - a.score,
					);
				const candidate = ranked[0];
				const matched =
					candidate && (candidate.urlMatch || candidate.score >= 0.82)
						? candidate.event
						: null;
				const facts = matched
					? factsFor(observation, matched)
					: {
							score: candidate ? Math.round(candidate.score * 100) : 0,
							agreed: [],
							conflict: false,
						};
				const checkStatus = matched
					? facts.conflict
						? "conflict"
						: "confirmed"
					: "unmatched";
				await db
					.insert(hackathonSourceChecks)
					.values({
						hackathonId: matched?.id ?? null,
						provider,
						sourceUrl: observation.sourceUrl,
						matchedTitle: observation.title,
						format: observation.format,
						startDate: observation.startDate,
						endDate: observation.endDate,
						venueCity: observation.venueCity,
						venueCountry: observation.venueCountry,
						prizeCurrency: observation.prizeCurrency,
						totalPrizeValue: observation.totalPrizeValue,
						matchScore: facts.score,
						checkStatus,
						agreedFields: facts.agreed,
					})
					.onConflictDoUpdate({
						target: [
							hackathonSourceChecks.provider,
							hackathonSourceChecks.sourceUrl,
						],
						set: {
							observedAt: new Date(),
							matchedTitle: observation.title,
							startDate: observation.startDate,
							endDate: observation.endDate,
							format: observation.format,
							venueCity: observation.venueCity,
							venueCountry: observation.venueCountry,
							prizeCurrency: observation.prizeCurrency,
							totalPrizeValue: observation.totalPrizeValue,
							matchScore: facts.score,
							checkStatus,
							agreedFields: facts.agreed,
						},
					});
				if (matched) summary.matched += 1;
				else summary.unmatched += 1;
				if (matched && facts.conflict) summary.conflicts += 1;
				else if (matched) summary.confirmed += 1;
			}
		} catch (error: unknown) {
			summary.error =
				error instanceof Error
					? error.message.slice(0, 400)
					: "Source page could not be read.";
		}
		summaries.push(summary);
		console.info(
			JSON.stringify({ event: "aggregator_cross_check", ...summary }),
		);
	}
	return summaries;
}
