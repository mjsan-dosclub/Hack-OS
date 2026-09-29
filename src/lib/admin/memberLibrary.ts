import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import {
	memberLibraryRowSchema,
	discPatternSchema,
	type MemberLibraryRow,
} from "@/schemas/admin";

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
	memberRows: MemberLibraryRow[];
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

function listValue(value: string | null): string[] {
	return value
		? [
				...new Set(
					value
						.split(/[,;|\n]+/)
						.map((part) => part.trim())
						.filter(Boolean),
				),
			].slice(0, 40)
		: [];
}

function validUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value.startsWith("www.") ? `https://${value}` : value);
		return url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function booleanValue(value: string | null): boolean | null {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (["yes", "true", "1", "y", "open to travel"].includes(normalized))
		return true;
	if (["no", "false", "0", "n", "not open"].includes(normalized)) return false;
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

function dateValue(value: string | null): string | null {
	if (!value) return null;
	const direct = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
	if (direct) return direct;
	const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
	if (dayFirst) {
		const day = Number(dayFirst[1]);
		const month = Number(dayFirst[2]);
		const year = Number(dayFirst[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		return date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
			? date.toISOString().slice(0, 10)
			: null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime())
		? null
		: parsed.toISOString().slice(0, 10);
}

function parseMemberRow(row: Record<string, unknown>): MemberLibraryRow | null {
	const email = parseEmail(
		fieldValue(row, [
			"email",
			"email address",
			"email id",
			"student email",
			"member email",
			"mail",
		]),
	);
	if (!email) return null;
	const statusValue = fieldValue(row, [
		"membership status",
		"member status",
		"status",
	])
		?.toLowerCase()
		.replaceAll(" ", "-");
	const membershipStatus =
		statusValue === "current" ||
		statusValue === "alumnus" ||
		statusValue === "mentor" ||
		statusValue === "guest"
			? statusValue
			: null;
	const agileValue = fieldValue(row, [
		"agile score",
		"agile compatibility",
		"agile",
	]);
	const cgpaValue = fieldValue(row, ["cgpa", "gpa", "grade point average"]);
	const cgpaParts = cgpaValue?.match(
		/^\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+(?:\.[0-9]+)?))?\s*$/,
	);
	const cgpa = cgpaParts ? Number(cgpaParts[1]) : null;
	const cgpaScaleValue = fieldValue(row, ["cgpa scale", "gpa scale", "scale"]);
	const cgpaScale = cgpaScaleValue
		? Number(cgpaScaleValue.replaceAll(",", ""))
		: cgpaParts?.[2]
			? Number(cgpaParts[2])
			: null;
	const agileScore =
		agileValue === null ? null : Number(agileValue.replaceAll(",", ""));
	const rawDiscProfile = fieldValue(row, [
		"disc profile",
		"disc pattern",
		"disc",
	])
		?.toUpperCase()
		.replace(/[^DISC]/g, "");
	const discResult = rawDiscProfile
		? discPatternSchema.safeParse(rawDiscProfile)
		: null;
	const discProfile = discResult?.success ? discResult.data : null;
	const projectText = fieldValue(row, [
		"recent projects",
		"project history",
		"projects",
	]);
	const projectLink = validUrl(
		fieldValue(row, ["project link", "project url"]),
	);
	const projectStack = listValue(
		fieldValue(row, ["project technologies", "project tech stack"]),
	);
	const recentProjects = projectText
		? projectText
				.split(/\s*[;|\n]+\s*/)
				.map((title) => ({
					title: title.slice(0, 180),
					techStack: projectStack,
					link: projectLink,
				}))
				.filter((project) => project.title.length > 0)
				.slice(0, 20)
		: [];
	const candidate: unknown = {
		email,
		fullName: fieldValue(row, [
			"full name",
			"student name",
			"member name",
			"name",
		]),
		collegeName: fieldValue(row, [
			"college",
			"college name",
			"university",
			"institution",
		]),
		degree: fieldValue(row, [
			"degree",
			"degree name",
			"college degree name",
			"qualification",
		]),
		department: fieldValue(row, [
			"department",
			"department name",
			"college department name",
			"branch",
			"major",
		]),
		gender: fieldValue(row, ["gender", "gender identity"]),
		dateOfBirth: dateValue(
			fieldValue(row, ["date of birth", "dob", "birth date"]),
		),
		cgpa: cgpa !== null && Number.isFinite(cgpa) ? cgpa : null,
		cgpaScale:
			cgpaScale !== null && Number.isFinite(cgpaScale) ? cgpaScale : null,
		membershipStatus,
		githubUrl: validUrl(
			fieldValue(row, ["github", "github url", "github profile"]),
		),
		linkedinUrl: validUrl(
			fieldValue(row, ["linkedin", "linkedin url", "linkedin profile"]),
		),
		portfolioUrl: validUrl(
			fieldValue(row, ["portfolio", "portfolio url", "website"]),
		),
		primarySkills: listValue(
			fieldValue(row, ["primary skills", "skills", "skill set", "skillset"]),
		),
		comfortableTech: listValue(
			fieldValue(row, [
				"comfortable tech",
				"tech comfort",
				"technology",
				"tech stack",
			]),
		),
		interests: listValue(
			fieldValue(row, [
				"interests",
				"interest",
				"domains",
				"areas of interest",
			]),
		),
		collegeYear: fieldValue(row, [
			"college year",
			"academic year",
			"year of study",
			"graduation year",
			"batch",
		]),
		currentJobOrStudy: fieldValue(row, [
			"current role",
			"current job",
			"job or study",
			"position",
			"occupation",
		]),
		locationCity: fieldValue(row, ["city", "location city", "current city"]),
		canTravel: booleanValue(
			fieldValue(row, ["can travel", "travel flexibility", "open to travel"]),
		),
		recentProjects,
		discProfile,
		agileScore:
			agileScore !== null && Number.isFinite(agileScore) ? agileScore : null,
		assessedAt: dateValue(
			fieldValue(row, ["assessed at", "assessment date", "test date"]),
		),
		assessmentConsented: consentValue(
			fieldValue(row, [
				"assessment consent",
				"consent",
				"consented",
				"permission to use assessment",
			]),
		),
	};
	const parsed = memberLibraryRowSchema.safeParse(candidate);
	return parsed.success ? parsed.data : null;
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
	memberRows: MemberLibraryRow[];
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
	const memberRows: MemberLibraryRow[] = [];
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
			const memberRow = parseMemberRow(row);
			if (memberRow) memberRows.push(memberRow);
			const assessmentDataPresent = Boolean(
				fieldValue(row, ["disc profile", "disc pattern", "disc"]) ||
					fieldValue(row, ["agile score", "agile compatibility", "agile"]),
			);
			const assessmentConsented =
				memberRow?.assessmentConsented ??
				consentValue(
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
	return { chunks, memberRows };
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
	let memberRows: MemberLibraryRow[] = [];
	if (["xlsx", "xls", "csv"].includes(extension ?? "")) {
		const parsed = parseStructuredWorkbook(bytes);
		chunks = parsed.chunks;
		memberRows = parsed.memberRows;
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
	return { contentType, sha256, chunks, memberRows };
}
