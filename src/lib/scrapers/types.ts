import type { HackathonSource } from "../../types/hackathon.ts";

export type ScraperName = Extract<
	HackathonSource,
	"devpost" | "devfolio" | "unstop"
>;
export const HACKATHON_SCRAPER_SOURCES = [
	"devpost",
	"devfolio",
	"unstop",
] as const;
export type HackathonScraperSource = (typeof HACKATHON_SCRAPER_SOURCES)[number];

/** Untrusted, source-shaped fields. Only the sanitizer may create database input. */
export interface RawHackathonData {
	source: ScraperName;
	sourceId: string;
	sourceUrl: string;
	title: string;
	organizer?: string;
	description?: string;
	eligibilityRules?: string;
	submissionGuidelines?: string;
	rawText: string;
	bannerUrl?: string;
	venueText?: string;
	formatHint?: string;
	startDateText?: string;
	endDateText?: string;
	registrationDeadlineText?: string;
	prizeText?: string;
	tags: string[];
	tracks: Array<{ title: string; description?: string; prizeText?: string }>;
}

export interface ScraperMetrics {
	parsed: number;
	failed: number;
	skipped: number;
}

export interface ScraperLogger {
	record(
		event: string,
		fields?: Readonly<Record<string, string | number | boolean>>,
	): void;
}

export const scraperLogger: ScraperLogger = {
	record(event, fields = {}) {
		console.info(
			JSON.stringify({
				level: "info",
				subsystem: "hackathon-scraper",
				event,
				...fields,
			}),
		);
	},
};
