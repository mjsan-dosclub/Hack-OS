import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { z } from "zod";
import { getDatabase } from "@/db/client";
import { hackathons } from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import {
	bulkManualEventsResultSchema,
	manualEventSchema,
} from "@/schemas/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EVENT_ROWS = 500;
type EventDraft = z.infer<typeof manualEventSchema>;
type EventImportIssue = z.infer<
	typeof bulkManualEventsResultSchema
>["issues"][number];
type ParsedEventRow = {
	rowNumber: number;
	event: EventDraft;
	values: EventImportIssue["values"];
};

function headerKey(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function value(row: Record<string, unknown>, aliases: string[]): string {
	const keys = new Set(aliases.map(headerKey));
	for (const [key, raw] of Object.entries(row)) {
		if (keys.has(headerKey(key)) && raw !== null && raw !== undefined) {
			return String(raw).trim();
		}
	}
	return "";
}

function nullable(value: string): string | null {
	return value.length ? value : null;
}

function parseDate(value: string): string {
	const input = value.trim();
	if (!input) return "";
	const indianDate =
		/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i.exec(
			input,
		);
	if (indianDate) {
		const day = Number(indianDate[1]);
		const month = Number(indianDate[2]);
		const year = Number(indianDate[3]);
		let hour = Number(indianDate[4] ?? "0");
		const minute = Number(indianDate[5] ?? "0");
		const meridiem = indianDate[6]?.toUpperCase();
		if (meridiem) {
			if (hour < 1 || hour > 12 || minute > 59) return "";
			hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
		} else if (hour > 23 || minute > 59) {
			return "";
		}
		const calendar = new Date(Date.UTC(year, month - 1, day));
		if (
			calendar.getUTCFullYear() !== year ||
			calendar.getUTCMonth() !== month - 1 ||
			calendar.getUTCDate() !== day
		)
			return "";
		return new Date(
			Date.UTC(year, month - 1, day, hour - 5, minute - 30),
		).toISOString();
	}
	const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);
	const isoLocal =
		/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/i.test(input);
	const time = Date.parse(
		isoLocal && !hasExplicitZone ? `${input}+05:30` : input,
	);
	return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function issueMessage(issue: z.ZodIssue): string {
	const field = issue.path[0];
	if (field === "format" && issue.code === "invalid_enum_value")
		return "Format must be online, in-person, or hybrid.";
	if (field === "applicationStatus" && issue.code === "invalid_enum_value")
		return "Status must be upcoming, open, closed, or ended.";
	if (field === "startDate" && issue.message === "Invalid datetime")
		return "Enter a valid start date and time.";
	if (field === "endDate" && issue.message === "Invalid datetime")
		return "Enter a valid end date and time.";
	if (field === "registrationDeadline" && issue.message === "Invalid datetime")
		return "Enter a valid registration deadline, or leave it blank.";
	if (field === "totalPrizeValue" && issue.code === "too_small")
		return "Prize value must be zero or greater.";
	return `${typeof field === "string" ? field : "Event"}: ${issue.message}`;
}

function parseBulkEvents(
	fileName: string,
	bytes: Buffer,
): { events: ParsedEventRow[]; issues: EventImportIssue[] } {
	if (!/\.(xlsx|xls|csv)$/i.test(fileName)) {
		throw new Error("Upload an Excel workbook or CSV file.");
	}
	let workbook: XLSX.WorkBook;
	try {
		workbook = XLSX.read(bytes, {
			type: "buffer",
			raw: false,
			cellDates: false,
		});
	} catch {
		throw new Error(
			"This spreadsheet could not be read. Re-save it and try again.",
		);
	}
	const sheetName = workbook.SheetNames[0];
	const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
	if (!sheet) throw new Error("The workbook has no worksheets.");
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: "",
		raw: false,
		blankrows: false,
	});
	if (!rows.length) throw new Error("The worksheet has no hackathon events.");
	if (rows.length > MAX_EVENT_ROWS) {
		throw new Error(`Upload at most ${MAX_EVENT_ROWS} events at a time.`);
	}
	const events: ParsedEventRow[] = [];
	const issues: EventImportIssue[] = [];
	rows.forEach((row, index) => {
		const rowNumber = index + 2;
		const formatRaw = value(row, ["format", "event format"])
			.toLowerCase()
			.replaceAll("_", "-");
		const formatText =
			formatRaw === "offline" || formatRaw === "in person"
				? "in-person"
				: formatRaw === "virtual"
					? "online"
					: formatRaw;
		const statusAtCity = value(row, [
			"venue city",
			"city",
			"location city",
		]).toLowerCase();
		const usesLegacyColumnOrder = [
			"open",
			"upcoming",
			"closed",
			"ended",
		].includes(statusAtCity);
		const statusText = usesLegacyColumnOrder
			? statusAtCity
			: value(row, [
					"application status",
					"registration status",
					"status",
				]).toLowerCase();
		const currencyText = value(row, ["prize currency", "currency"]);
		const prizeSource = value(row, [
			"total prize value",
			"prize value",
			"prize pool",
		]);
		const prizeText = prizeSource.replace(/[^0-9.-]/g, "");
		const prizeValue = prizeText ? Number(prizeText) : 0;
		const title = value(row, ["title", "event title", "hackathon"]);
		const organizer = value(row, ["organizer", "host", "organization"]);
		const officialUrl = value(row, [
			"official url",
			"website url",
			"website",
			"url",
			"registration link",
		]);
		const description = usesLegacyColumnOrder
			? value(row, ["banner url", "banner image url", "image url"])
			: value(row, ["description", "summary"]);
		const bannerUrl = usesLegacyColumnOrder
			? value(row, ["description", "summary"])
			: value(row, ["banner url", "banner image url", "image url"]);
		const venueCity = usesLegacyColumnOrder
			? value(row, ["venue country", "country", "location country"])
			: value(row, ["venue city", "city", "location city"]);
		const venueCountry = usesLegacyColumnOrder
			? value(row, ["start date", "start", "event start"])
			: value(row, ["venue country", "country", "location country"]);
		const startText = usesLegacyColumnOrder
			? value(row, ["end date", "end", "event end"])
			: value(row, ["start date", "start", "event start"]);
		const endText = usesLegacyColumnOrder
			? value(row, [
					"registration deadline",
					"deadline",
					"application deadline",
				])
			: value(row, ["end date", "end", "event end"]);
		const deadlineText = usesLegacyColumnOrder
			? value(row, ["application status"])
			: value(row, [
					"registration deadline",
					"deadline",
					"application deadline",
				]);
		const values = {
			title,
			organizer,
			official_url: officialUrl,
			description,
			banner_url: bannerUrl,
			format: formatText || "online",
			venue_city: venueCity,
			venue_country: venueCountry,
			start_date: startText,
			end_date: endText,
			registration_deadline: deadlineText,
			application_status: statusText || "upcoming",
			prize_currency: currencyText.toUpperCase() || "INR",
			total_prize_value: prizeSource || "0",
		};
		const parsed = manualEventSchema.safeParse({
			title,
			description,
			organizer,
			websiteUrl: officialUrl,
			bannerUrl: nullable(bannerUrl),
			format: formatText || "online",
			venueCity: nullable(venueCity),
			venueCountry: nullable(venueCountry),
			startDate: parseDate(startText),
			endDate: parseDate(endText),
			registrationDeadline: deadlineText ? parseDate(deadlineText) : null,
			applicationStatus: statusText || "upcoming",
			prizeCurrency: currencyText.toUpperCase() || "INR",
			totalPrizeValue: Number.isFinite(prizeValue)
				? Math.round(prizeValue)
				: -1,
		});
		if (!parsed.success) {
			issues.push({
				rowNumber,
				messages: [...new Set(parsed.error.issues.map(issueMessage))],
				values,
			});
			return;
		}
		events.push({ rowNumber, event: parsed.data, values });
	});
	return { events, issues };
}

export async function POST(request: Request) {
	try {
		await requireAdminMember();
		if (request.headers.get("origin") !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		const length = Number(request.headers.get("content-length") ?? 0);
		if (length > MAX_FILE_BYTES + 64_000) {
			return NextResponse.json(
				{ error: "Upload a file no larger than 10 MB." },
				{ status: 413 },
			);
		}
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return NextResponse.json(
				{ error: "Choose a hackathon workbook." },
				{ status: 400 },
			);
		}
		if (file.size === 0 || file.size > MAX_FILE_BYTES) {
			return NextResponse.json(
				{ error: "Upload a non-empty file no larger than 10 MB." },
				{ status: 413 },
			);
		}
		let parsedEvents: ReturnType<typeof parseBulkEvents>;
		try {
			parsedEvents = parseBulkEvents(
				file.name,
				Buffer.from(await file.arrayBuffer()),
			);
		} catch (error: unknown) {
			return NextResponse.json(
				{
					error:
						error instanceof Error
							? error.message
							: "The event workbook is invalid.",
				},
				{ status: 400 },
			);
		}
		const db = getDatabase();
		const seenUrls = new Set<string>();
		const uniqueEvents = parsedEvents.events.filter((row) => {
			const key = row.event.websiteUrl.toLowerCase().replace(/\/$/, "");
			if (seenUrls.has(key)) return false;
			seenUrls.add(key);
			return true;
		});
		const existingUrls = uniqueEvents.length
			? await db
					.select({ websiteUrl: hackathons.websiteUrl })
					.from(hackathons)
					.where(
						inArray(
							hackathons.websiteUrl,
							uniqueEvents.map((row) => row.event.websiteUrl),
						),
					)
			: [];
		const existingSet = new Set(
			existingUrls.map((event) =>
				event.websiteUrl.toLowerCase().replace(/\/$/, ""),
			),
		);
		const toCreate = uniqueEvents.filter(
			(row) =>
				!existingSet.has(row.event.websiteUrl.toLowerCase().replace(/\/$/, "")),
		);
		await db.transaction(async (tx) => {
			for (const row of toCreate) {
				const event = row.event;
				const baseSlug =
					event.title
						.toLowerCase()
						.normalize("NFKD")
						.replace(/[\u0300-\u036f]/g, "")
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-|-$/g, "")
						.slice(0, 160) || "hackathon";
				await tx.insert(hackathons).values({
					slug: `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`,
					...event,
					startDate: new Date(event.startDate),
					endDate: new Date(event.endDate),
					registrationDeadline: event.registrationDeadline
						? new Date(event.registrationDeadline)
						: null,
					source: "manual",
					verified: false,
					published: false,
				});
			}
		});
		const result = bulkManualEventsResultSchema.safeParse({
			added: toCreate.length,
			duplicatesSkipped: parsedEvents.events.length - toCreate.length,
			issueCount: parsedEvents.issues.length,
			issues: parsedEvents.issues,
		});
		if (!result.success)
			throw new Error("The import summary response was invalid.");
		return NextResponse.json(result.data, {
			status: 201,
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error: unknown) {
		if (error instanceof MemberAccessError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}
		console.error("[event-bulk-import] Request failed.");
		return NextResponse.json(
			{ error: "Bulk event import is temporarily unavailable." },
			{ status: 500 },
		);
	}
}
