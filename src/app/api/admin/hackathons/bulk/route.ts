import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDatabase } from "@/db/client";
import { hackathons } from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import {
	bulkManualEventsResultSchema,
	bulkManualEventsSchema,
	manualEventSchema,
} from "@/schemas/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EVENT_ROWS = 500;

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

function parseDate(value: string, field: string, rowNumber: number): string {
	const time = Date.parse(value);
	if (!value || !Number.isFinite(time)) {
		throw new Error(`Row ${rowNumber}: enter a valid ${field} date and time.`);
	}
	return new Date(time).toISOString();
}

function parseBulkEvents(fileName: string, bytes: Buffer) {
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
	const events = rows.map((row, index) => {
		const rowNumber = index + 2;
		const formatValue = value(row, ["format", "event format"])
			.toLowerCase()
			.replaceAll("_", "-");
		const statusValue = value(row, [
			"application status",
			"registration status",
			"status",
		]).toLowerCase();
		const currency =
			value(row, ["prize currency", "currency"]).toUpperCase() || "INR";
		const prizeText = value(row, [
			"total prize value",
			"prize value",
			"prize pool",
		]).replace(/[^0-9.-]/g, "");
		const prizeValue = prizeText ? Number(prizeText) : 0;
		const parsed = manualEventSchema.safeParse({
			title: value(row, ["title", "event title", "hackathon"]),
			description: value(row, ["description", "summary"]),
			organizer: value(row, ["organizer", "host", "organization"]),
			websiteUrl: value(row, [
				"official url",
				"website url",
				"website",
				"url",
				"registration link",
			]),
			bannerUrl: nullable(
				value(row, ["banner url", "banner image url", "image url"]),
			),
			format:
				formatValue === "in-person" || formatValue === "hybrid"
					? formatValue
					: "online",
			venueCity: nullable(value(row, ["venue city", "city", "location city"])),
			venueCountry: nullable(
				value(row, ["venue country", "country", "location country"]),
			),
			startDate: parseDate(
				value(row, ["start date", "start", "event start"]),
				"start",
				rowNumber,
			),
			endDate: parseDate(
				value(row, ["end date", "end", "event end"]),
				"end",
				rowNumber,
			),
			registrationDeadline: value(row, [
				"registration deadline",
				"deadline",
				"application deadline",
			])
				? parseDate(
						value(row, [
							"registration deadline",
							"deadline",
							"application deadline",
						]),
						"registration deadline",
						rowNumber,
					)
				: null,
			applicationStatus:
				statusValue === "open" ||
				statusValue === "closed" ||
				statusValue === "ended"
					? statusValue
					: "upcoming",
			prizeCurrency: currency,
			totalPrizeValue: Number.isFinite(prizeValue)
				? Math.round(prizeValue)
				: -1,
		});
		if (!parsed.success) {
			throw new Error(
				`Row ${rowNumber}: ${parsed.error.issues[0]?.message ?? "check this event's fields."}`,
			);
		}
		return parsed.data;
	});
	const validated = bulkManualEventsSchema.safeParse(events);
	if (!validated.success) {
		throw new Error(
			validated.error.issues[0]?.message ?? "Check the event fields.",
		);
	}
	return validated.data;
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
		let events: ReturnType<typeof parseBulkEvents>;
		try {
			events = parseBulkEvents(
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
		const uniqueEvents = events.filter((event) => {
			const key = event.websiteUrl.toLowerCase().replace(/\/$/, "");
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
							uniqueEvents.map((event) => event.websiteUrl),
						),
					)
			: [];
		const existingSet = new Set(
			existingUrls.map((event) =>
				event.websiteUrl.toLowerCase().replace(/\/$/, ""),
			),
		);
		const toCreate = uniqueEvents.filter(
			(event) =>
				!existingSet.has(event.websiteUrl.toLowerCase().replace(/\/$/, "")),
		);
		await db.transaction(async (tx) => {
			for (const event of toCreate) {
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
			duplicatesSkipped: events.length - toCreate.length,
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
