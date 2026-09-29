export const HACKATHON_FORMATS = ["online", "in-person", "hybrid"] as const;
export const APPLICATION_STATUSES = [
	"upcoming",
	"open",
	"closed",
	"ended",
] as const;
export const HACKATHON_SOURCES = [
	"devpost",
	"devfolio",
	"unstop",
	"manual",
	"mlh",
] as const;

export type HackathonFormat = (typeof HACKATHON_FORMATS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type HackathonSource = (typeof HACKATHON_SOURCES)[number];

export interface Coordinates {
	latitude: number;
	longitude: number;
}

/** Public shape used by cards, map pins, timeline, and search results. */
export interface Hackathon {
	id: string;
	slug: string;
	title: string;
	description: string;
	eligibilityRules: string;
	submissionGuidelines: string;
	organizer: string;
	websiteUrl: string;
	bannerUrl: string | null;
	format: HackathonFormat;
	venueCity: string | null;
	venueCountry: string | null;
	coordinates: Coordinates | null;
	prizeCurrency: string;
	totalPrizeValue: number;
	startDate: string;
	endDate: string;
	registrationDeadline: string | null;
	applicationStatus: ApplicationStatus;
	source: HackathonSource;
	verified: boolean;
	tracks: HackathonTrack[];
	tags: HackathonTag[];
	createdAt: string;
}

export interface HackathonTrack {
	id: string;
	title: string;
	description: string;
	prizeAmount: number;
}

export interface HackathonTag {
	id: string;
	slug: string;
	name: string;
}
