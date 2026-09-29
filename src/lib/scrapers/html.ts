import * as cheerio from "cheerio";
import { z } from "zod";
import type { RawHackathonData, ScraperName } from "./types.ts";

const recordSchema = z.record(z.string(), z.unknown());

const clean = (value: string | undefined): string | undefined => {
	const text = value?.replace(/\s+/g, " ").trim();
	return text ? text.slice(0, 10_000) : undefined;
};

function labeledText(
	text: string,
	labels: string,
	stopLabels: string,
): string | undefined {
	const match = text.match(
		new RegExp(
			`(?:${labels})\\s*[:–-]\\s*(.{8,800}?)(?=(?:${stopLabels})\\s*[:–-]|$)`,
			"i",
		),
	);
	return clean(match?.[1]);
}

function absoluteUrl(value: string | undefined, base: URL): string | undefined {
	if (!value) return undefined;
	try {
		const url = new URL(value, base);
		return url.protocol === "https:" ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

function belongsToSourceHost(
	url: URL,
	base: URL,
	source?: ScraperName,
): boolean {
	if (source === "unstop" || base.hostname === "api.unstop.com")
		return (
			url.hostname === "unstop.com" || url.hostname.endsWith(".unstop.com")
		);
	return (
		url.hostname === base.hostname || url.hostname.endsWith(`.${base.hostname}`)
	);
}

/** Follows only explicit same-source pagination links; never invents query parameters. */
export function findNextListingPage(html: string, currentUrl: URL): URL | null {
	const $ = cheerio.load(html);
	const selectors = [
		"a[rel~='next']",
		"a[aria-label*='next' i]",
		"a[title*='next' i]",
		"a[class*='next' i]",
	];
	for (const selector of selectors) {
		const href = $(selector).first().attr("href");
		if (!href) continue;
		try {
			const next = new URL(href, currentUrl);
			if (
				next.protocol === "https:" &&
				belongsToSourceHost(next, currentUrl) &&
				next.href !== currentUrl.href
			)
				return next;
		} catch {
			/* Invalid pagination link is ignored. */
		}
	}
	return null;
}

/** Parses JSON-LD event cards and source-specific linked cards without trusting selectors. */
export function parseEventListing(
	html: string,
	base: URL,
	source: ScraperName,
): RawHackathonData[] {
	const $ = cheerio.load(html);
	const events: RawHackathonData[] = [];
	const seen = new Set<string>();

	const addEvent = (input: {
		url?: string;
		title?: string;
		organizer?: string;
		description?: string;
		image?: string;
		location?: string;
		start?: string;
		end?: string;
		deadline?: string;
		prize?: string;
		text?: string;
		eligibility?: string;
		submission?: string;
		tags?: string[];
		sourceId?: string;
	}): void => {
		const sourceUrl = absoluteUrl(input.url, base);
		const title = clean(input.title);
		if (!sourceUrl || !title || seen.has(sourceUrl)) return;
		const parsed = new URL(sourceUrl);
		if (!belongsToSourceHost(parsed, base, source)) return;
		seen.add(sourceUrl);
		const sourceId =
			clean(input.sourceId) ??
			parsed.pathname.split("/").filter(Boolean).at(-1) ??
			sourceUrl;
		const rawText =
			clean(
				[
					input.text,
					input.description,
					input.location,
					input.start,
					input.end,
					input.deadline,
					input.prize,
				]
					.filter(Boolean)
					.join(" "),
			) ?? title;
		events.push({
			source,
			sourceId,
			sourceUrl,
			title,
			organizer: clean(input.organizer),
			description: clean(input.description),
			rawText,
			eligibilityRules: clean(input.eligibility),
			submissionGuidelines: clean(input.submission),
			bannerUrl: absoluteUrl(input.image, base),
			venueText: clean(input.location),
			formatHint:
				/online|virtual|remote/i.test(input.location ?? "") ||
				/online[- ]only|fully online|virtual(?:-only)?|remote(?:-only)? participation|join anywhere/i.test(
					rawText,
				)
					? "online"
					: undefined,
			startDateText: clean(input.start),
			endDateText: clean(input.end),
			registrationDeadlineText: clean(input.deadline),
			prizeText: clean(input.prize),
			tags: (input.tags ?? [])
				.map((tag) => tag.trim())
				.filter(Boolean)
				.slice(0, 20),
			tracks: [],
		});
	};

	const walkJsonLd = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const item of node) walkJsonLd(item);
			return;
		}
		if (typeof node !== "object" || node === null) return;
		const parsedRecord = recordSchema.safeParse(node);
		if (!parsedRecord.success) return;
		const record = parsedRecord.data;
		const type = record["@type"];
		const isEvent =
			type === "Event" || (Array.isArray(type) && type.includes("Event"));
		if (isEvent) {
			const location = record.location;
			const placeResult = recordSchema.safeParse(location);
			const place = placeResult.success ? placeResult.data : {};
			const addressResult = recordSchema.safeParse(place.address);
			const address = addressResult.success ? addressResult.data : {};
			const organizerResult = recordSchema.safeParse(record.organizer);
			const organizer = organizerResult.success ? organizerResult.data : {};
			const image = Array.isArray(record.image)
				? record.image[0]
				: record.image;
			const offers = Array.isArray(record.offers)
				? record.offers[0]
				: record.offers;
			const offerResult = recordSchema.safeParse(offers);
			const offer = offerResult.success ? offerResult.data : {};
			addEvent({
				url: typeof record.url === "string" ? record.url : undefined,
				title: typeof record.name === "string" ? record.name : undefined,
				organizer:
					typeof organizer.name === "string" ? organizer.name : undefined,
				description:
					typeof record.description === "string"
						? record.description
						: undefined,
				image: typeof image === "string" ? image : undefined,
				location:
					[
						address.addressLocality,
						address.addressRegion,
						address.addressCountry,
					]
						.filter((part): part is string => typeof part === "string")
						.join(", ") ||
					(typeof place.name === "string" ? place.name : undefined),
				start:
					typeof record.startDate === "string" ? record.startDate : undefined,
				end: typeof record.endDate === "string" ? record.endDate : undefined,
				deadline:
					typeof offer.validThrough === "string"
						? offer.validThrough
						: undefined,
				prize:
					typeof offer.price === "string" || typeof offer.price === "number"
						? String(offer.price)
						: undefined,
			});
		}
		for (const value of Object.values(record)) walkJsonLd(value);
	};

	$("script[type='application/ld+json']").each((_index, element) => {
		const raw = $(element).contents().text();
		try {
			const parsedJson: unknown = JSON.parse(raw);
			walkJsonLd(parsedJson);
		} catch {
			/* Invalid JSON-LD is ignored; card parsing continues. */
		}
	});

	// The sources change card markup periodically; infer candidate records from same-origin event links.
	$("a[href]").each((_index, element) => {
		const anchor = $(element);
		const href = anchor.attr("href");
		if (!href) return;
		const url = absoluteUrl(href, base);
		if (!url) return;
		const pathname = new URL(url).pathname;
		const isSubdomainEvent = new URL(url).hostname !== base.hostname;
		const looksLikeEvent =
			source === "devpost"
				? /^\/hackathons\/[^/]+/.test(pathname)
				: source === "devfolio"
					? isSubdomainEvent ||
						/\/events?\/[^/]+|\/[^/]+\/events?\/[^/]+/.test(pathname)
					: /\/hackathons?\/[^/]+|\/competitions?\/[^/]+/.test(pathname);
		if (!looksLikeEvent || seen.has(url)) return;
		const card = anchor.closest(
			"article, [data-testid*='card'], [class*='card'], li, .event",
		);
		const scope = card.length ? card : anchor;
		const text = clean(scope.text());
		const title =
			clean(anchor.attr("aria-label")) ??
			clean(anchor.find("h1,h2,h3,h4").first().text()) ??
			clean(anchor.text());
		if (!title || title.length < 4 || !text) return;
		const image =
			scope.find("img").first().attr("src") ??
			scope.find("img").first().attr("data-src");
		const dateValues = scope
			.find("time")
			.map((_i, time) => $(time).attr("datetime") ?? $(time).text())
			.get();
		const startDateText = clean(dateValues[0]);
		const endDateText = clean(dateValues[1]);
		const location = clean(
			scope
				.find("[class*='location'], [data-testid*='location']")
				.first()
				.text(),
		);
		addEvent({
			url,
			title,
			text,
			description: text,
			image,
			start: startDateText,
			end: endDateText,
			location,
			eligibility: labeledText(
				text ?? "",
				"eligibility|who can apply|who can participate",
				"submission|prizes?|deadline|registration|register",
			),
			submission: labeledText(
				text ?? "",
				"submission guidelines|submission requirements",
				"eligibility|prizes?|deadline|registration|register",
			),
		});
	});

	return events;
}

/** Extracts explicit event facts from a linked event page without guessing missing values. */
export function parseEventDetailPage(
	html: string,
	eventUrl: URL,
	source: ScraperName,
): RawHackathonData {
	const $ = cheerio.load(html);
	const structured = parseEventListing(html, eventUrl, source).find(
		(event) => event.sourceUrl === eventUrl.href,
	);
	const bodyText = clean($("body").text()) ?? "";
	const title =
		clean($("h1").first().text()) ??
		clean($("meta[property='og:title']").attr("content")) ??
		structured?.title ??
		"";
	const pageTitle =
		clean($("meta[property='og:title']").attr("content")) ?? $("title").text();
	const description =
		clean($("meta[property='og:description']").attr("content")) ??
		clean($("meta[name='description']").attr("content")) ??
		structured?.description;
	const startMeta = $(
		"meta[itemprop='startDate'], meta[property='event:start_time']",
	)
		.first()
		.attr("content");
	const endMeta = $("meta[itemprop='endDate'], meta[property='event:end_time']")
		.first()
		.attr("content");
	const startTime = $("time[datetime]").first().attr("datetime");
	const endTime = $("time[datetime]").eq(1).attr("datetime");
	const range = bodyText.match(
		/(?:runs? from|event dates?|hackathon dates?)\s*:?\s*([A-Z][a-z]+\s+\d{1,2})\s*[-–—]\s*([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})/i,
	);
	const rangeYear = range?.[2]?.match(/20\d{2}/)?.[0];
	const startDateText =
		startMeta ??
		startTime ??
		structured?.startDateText ??
		(range?.[1] && rangeYear ? `${range[1]}, ${rangeYear}` : undefined);
	const endDateText =
		endMeta ?? endTime ?? structured?.endDateText ?? range?.[2];
	const locationText =
		clean(
			$(
				"[itemprop='address'], address, [class*='venue' i], [class*='location' i]",
			)
				.first()
				.text(),
		) ?? structured?.venueText;
	const image =
		clean($("meta[property='og:image']").attr("content")) ??
		structured?.bannerUrl;
	const deadline = bodyText.match(
		/(?:registration|application)s?\s+(?:close|deadline)(?:s)?\s*(?:on|is|:)?\s*([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})/i,
	)?.[1];
	const prize =
		bodyText.match(
			/(?:total\s+)?prize\s+(?:pool|money|worth|of)?[^\d₹$€£]{0,30}(?:₹|\$|€|£|INR|USD|EUR|GBP)?\s*[\d,]+(?:\.\d+)?\s*[kKmM]?/i,
		)?.[0] ?? structured?.prizeText;
	const sourceId =
		structured?.sourceId ??
		eventUrl.pathname.split("/").filter(Boolean).at(-1) ??
		eventUrl.href;
	const combinedText = `${pageTitle} ${bodyText}`
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 10_000);
	const eligibility = labeledText(
		bodyText,
		"eligibility|who can apply|who can participate",
		"submission|prizes?|deadline|registration|register",
	);
	const submission = labeledText(
		bodyText,
		"submission guidelines|submission requirements",
		"eligibility|prizes?|deadline|registration|register",
	);
	const explicitOnline =
		/\b(online|virtual)\b/i.test(`${locationText ?? ""} ${bodyText}`) &&
		!/\boffline\b/i.test(`${locationText ?? ""} ${bodyText}`);
	return {
		source,
		sourceId,
		sourceUrl: eventUrl.href,
		title: title || structured?.title || pageTitle || eventUrl.hostname,
		organizer: structured?.organizer,
		description,
		rawText: combinedText,
		eligibilityRules: eligibility ?? structured?.eligibilityRules,
		submissionGuidelines: submission ?? structured?.submissionGuidelines,
		bannerUrl: image,
		venueText: locationText,
		formatHint: explicitOnline ? "online" : structured?.formatHint,
		startDateText,
		endDateText,
		registrationDeadlineText: deadline ?? structured?.registrationDeadlineText,
		prizeText: prize,
		tags: structured?.tags ?? [],
		tracks: structured?.tracks ?? [],
	};
}

/** Parses Devpost's public RSS items using Cheerio's XML mode. */
export function parseDevpostRss(xml: string, feedUrl: URL): RawHackathonData[] {
	const $ = cheerio.load(xml, { xml: true });
	const events: RawHackathonData[] = [];
	$("item").each((_index, element) => {
		const item = $(element);
		const link = item.find("link").first().text().trim();
		const title = clean(item.find("title").first().text());
		if (!title || !link) return;
		const url = absoluteUrl(link, feedUrl);
		if (!url || new URL(url).origin !== feedUrl.origin) return;
		const description = clean(item.find("description").first().text());
		const sourceId =
			new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? url;
		events.push({
			source: "devpost",
			sourceId,
			sourceUrl: url,
			title,
			rawText: description ?? title,
			description,
			tags: item
				.find("category")
				.map((_i, tag) => $(tag).text().trim())
				.get(),
			tracks: [],
		});
	});
	return events;
}
