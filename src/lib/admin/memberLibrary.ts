import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export const MEMBER_LIBRARY_MAX_BYTES = 10 * 1024 * 1024;
const MAX_SHEETS = 12;
const MAX_ROWS = 5_000;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const TEXT_CHUNK_SIZE = 4_000;

export interface ExtractedLibraryChunk {
	chunkIndex: number;
	sheetName: string | null;
	spreadsheetRow: number | null;
	memberEmail: string | null;
	content: string;
}

export interface ParsedLibraryFile {
	contentType: string;
	sha256: string;
	chunks: ExtractedLibraryChunk[];
}

export class MemberLibraryFileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MemberLibraryFileError";
	}
}

function typeForExtension(filename: string): string {
	const extension = filename.split(".").at(-1)?.toLowerCase();
	switch (extension) {
		case "xlsx":
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		case "xls":
			return "application/vnd.ms-excel";
		case "csv":
			return "text/csv";
		case "txt":
			return "text/plain";
		case "md":
			return "text/markdown";
		case "json":
			return "application/json";
		default:
			throw new MemberLibraryFileError(
				"Upload an Excel (.xlsx or .xls), CSV, text, Markdown, or JSON file.",
			);
	}
}

function cleanCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (value instanceof Date) return value.toISOString();
	return JSON.stringify(value);
}

function normalizeHeader(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isDirectIdentifierHeader(value: string): boolean {
	const normalized = normalizeHeader(value);
	return (
		new Set([
			"name",
			"fullname",
			"firstname",
			"lastname",
			"studentname",
			"membername",
			"email",
			"emailaddress",
			"emailid",
			"studentemail",
			"memberemail",
			"mail",
			"phone",
			"phonenumber",
			"mobile",
			"mobilenumber",
			"address",
			"homeaddress",
			"linkedin",
			"linkedinurl",
			"github",
			"githuburl",
			"portfolio",
			"portfoliourl",
			"socialmedia",
			"gender",
			"sex",
			"dateofbirth",
			"dob",
			"birthday",
			"age",
			"cgpa",
			"gpa",
			"cgpascale",
			"gpascal",
			"academicscore",
			"academicrecord",
			"consent",
			"assessmentconsent",
		]).has(normalized) ||
		/^(cgpa|gpa|academic|gender|dob|dateofbirth|birthday|age)/.test(normalized)
	);
}

function emailColumn(headers: string[]): string | null {
	const possibleHeaders = new Set([
		"email",
		"emailaddress",
		"emailid",
		"mail",
		"studentemail",
		"memberemail",
	]);
	return (
		headers.find((header) => possibleHeaders.has(normalizeHeader(header))) ??
		null
	);
}

function parseEmail(value: string | null | undefined): string | null {
	const email = value?.trim().toLowerCase() ?? "";
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function fieldValue(
	row: Record<string, unknown>,
	aliases: string[],
): string | null {
	const keys = new Map(
		Object.keys(row).map((key) => [normalizeHeader(key), key]),
	);
	for (const alias of aliases) {
		const key = keys.get(normalizeHeader(alias));
		if (key !== undefined) {
			const value = cleanCell(row[key]);
			if (value) return value;
		}
	}
	return null;
}

function consentValue(value: string | null): boolean {
	return (
		value !== null &&
		["yes", "true", "1", "y", "consented", "granted"].includes(
			value.toLowerCase(),
		)
	);
}

function splitText(text: string): string[] {
	const normalized = text.replaceAll(String.fromCharCode(0), "").trim();
	if (!normalized) return [];
	const result: string[] = [];
	for (let offset = 0; offset < normalized.length; offset += TEXT_CHUNK_SIZE) {
		result.push(normalized.slice(offset, offset + TEXT_CHUNK_SIZE));
	}
	return result;
}

/**
 * Remove sensitive roster/assessment fields before uploaded text enters the
 * searchable index. The original remains available only in private storage.
 */
function sanitizeIndexedText(
	content: string,
	assessmentConsented: boolean,
): string {
	return content
		.split(/\r?\n/)
		.filter((line) => {
			const normalized = line.trim().toLowerCase();
			if (!normalized) return true;
			if (/^(assessment\s+)?consent\s*[:=]/i.test(normalized)) return false;
			if (
				/^(name|full\s*name|student\s*name|member\s*name|gender|sex|date\s*of\s*birth|birth\s*date|dob|birthday|age|cgpa|gpa|grade\s*point\s*average|academic\s*(score|record))\s*[:=]/i.test(
					normalized,
				)
			)
				return false;
			if (
				!assessmentConsented &&
				/^(disc(?:\s*(?:profile|pattern))?|agile(?:\s*(?:score|compatibility))?)\s*[:=]/i.test(
					normalized,
				)
			)
				return false;
			return true;
		})
		.join("\n")
		.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email removed]")
		.replace(/https?:\/\/\S+/gi, "[link removed]")
		.replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[phone removed]")
		.trim();
}

function parseStructuredWorkbook(bytes: Buffer): {
	chunks: ExtractedLibraryChunk[];
} {
	let workbook: XLSX.WorkBook;
	try {
		workbook = XLSX.read(bytes, {
			type: "buffer",
			raw: false,
			cellDates: false,
			cellFormula: false,
			cellHTML: false,
			sheetRows: MAX_ROWS + 1,
		});
	} catch {
		throw new MemberLibraryFileError(
			"This spreadsheet could not be read. Save it as a valid Excel or CSV file and try again.",
		);
	}
	if (workbook.SheetNames.length > MAX_SHEETS) {
		throw new MemberLibraryFileError(
			`A workbook can contain at most ${MAX_SHEETS} sheets per upload.`,
		);
	}

	const chunks: ExtractedLibraryChunk[] = [];
	let rowCount = 0;
	let characterCount = 0;
	for (const sheetName of workbook.SheetNames) {
		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) continue;
		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
			defval: "",
			raw: false,
			blankrows: false,
		});
		if (rows.length === 0) continue;
		const headers = Object.keys(rows[0] ?? {});
		const memberEmailHeader = emailColumn(headers);
		for (let index = 0; index < rows.length; index += 1) {
			const row = rows[index];
			if (!row) continue;
			const assessmentDataPresent = Boolean(
				fieldValue(row, ["disc profile", "disc pattern", "disc"]) ||
					fieldValue(row, ["agile score", "agile compatibility", "agile"]),
			);
			const assessmentConsented = consentValue(
				fieldValue(row, [
					"assessment consent",
					"consent",
					"consented",
					"permission to use assessment",
				]),
			);
			const fields = Object.entries(row)
				.map(([key, value]) => [key.trim(), cleanCell(value)] as const)
				.filter(
					([key, value]) =>
						key.length > 0 &&
						value.length > 0 &&
						!isDirectIdentifierHeader(key) &&
						!(
							assessmentDataPresent &&
							!assessmentConsented &&
							/^(disc|agile)/i.test(normalizeHeader(key))
						),
				);
			const rawEmail = memberEmailHeader
				? cleanCell(row[memberEmailHeader])
				: null;
			if (fields.length === 0) continue;
			rowCount += 1;
			if (rowCount > MAX_ROWS) {
				throw new MemberLibraryFileError(
					`A workbook can contain at most ${MAX_ROWS.toLocaleString()} non-empty rows per upload.`,
				);
			}
			const content = sanitizeIndexedText(
				fields.map(([key, value]) => `${key}: ${value}`).join("\n"),
				assessmentConsented,
			);
			if (!content) continue;
			characterCount += content.length;
			if (characterCount > MAX_EXTRACTED_CHARACTERS) {
				throw new MemberLibraryFileError(
					"The extracted workbook text is too large to index safely. Split the workbook into smaller files.",
				);
			}
			chunks.push({
				chunkIndex: chunks.length,
				sheetName: sheetName.slice(0, 120),
				spreadsheetRow: index + 2,
				memberEmail: parseEmail(rawEmail),
				content,
			});
		}
	}
	if (chunks.length === 0) {
		throw new MemberLibraryFileError(
			"The workbook has no non-empty rows to add to the library.",
		);
	}
	return { chunks };
}

export function parseMemberLibraryFile(
	filename: string,
	bytes: Buffer,
): ParsedLibraryFile {
	if (bytes.byteLength === 0 || bytes.byteLength > MEMBER_LIBRARY_MAX_BYTES) {
		throw new MemberLibraryFileError("Files must be between 1 byte and 10 MB.");
	}
	const contentType = typeForExtension(filename);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const extension = filename.split(".").at(-1)?.toLowerCase();
	let chunks: ExtractedLibraryChunk[];
	if (["xlsx", "xls", "csv"].includes(extension ?? "")) {
		const parsed = parseStructuredWorkbook(bytes);
		chunks = parsed.chunks;
	} else {
		let text = bytes.toString("utf8");
		if (extension === "json") {
			try {
				const parsedJson: unknown = JSON.parse(text);
				text = JSON.stringify(parsedJson, null, 2);
			} catch {
				throw new MemberLibraryFileError("The JSON file is not valid JSON.");
			}
		}
		if (text.includes("\uFFFD")) {
			throw new MemberLibraryFileError(
				"This text file is not valid UTF-8. Save it as UTF-8 and upload again.",
			);
		}
		const textChunks = splitText(text);
		if (textChunks.length === 0) {
			throw new MemberLibraryFileError("The text file is empty.");
		}
		if (text.length > MAX_EXTRACTED_CHARACTERS) {
			throw new MemberLibraryFileError(
				"The extracted text is too large to index safely. Split it into smaller files.",
			);
		}
		const assessmentConsented =
			/(?:assessment\s+)?consent\s*[:=]\s*(?:yes|true|1|consented|granted)\b/i.test(
				text,
			);
		chunks = textChunks.map((content, chunkIndex) => ({
			chunkIndex,
			sheetName: null,
			spreadsheetRow: null,
			memberEmail: (() => {
				const emails = [
					...new Set(content.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/g) ?? []),
				];
				return emails.length === 1 ? parseEmail(emails[0]) : null;
			})(),
			content: sanitizeIndexedText(content, assessmentConsented),
		}));
	}
	return { contentType, sha256, chunks };
}
