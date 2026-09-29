import { desc, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { z } from "zod";
import { getDatabase } from "@/db/client";
import { clubMembers } from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import {
	studentMasterListSchema,
	studentMasterManualInputSchema,
	studentMasterUploadResultSchema,
} from "@/schemas/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_STUDENT_ROWS = 10_000;
type StudentWriteRecord = z.infer<typeof studentMasterManualInputSchema>;
type ImportIssue = z.infer<
	typeof studentMasterUploadResultSchema
>["issues"][number];
const failure = (error: unknown) => {
	if (error instanceof MemberAccessError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: error.status },
		);
	}
	console.error("[admin-students] Request failed.");
	return NextResponse.json(
		{ error: "Student roster is temporarily unavailable." },
		{ status: 500 },
	);
};

function headerKey(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cell(row: Record<string, unknown>, aliases: string[]): string {
	const wanted = new Set(aliases.map(headerKey));
	for (const [key, value] of Object.entries(row)) {
		if (wanted.has(headerKey(key)) && value !== null && value !== undefined) {
			return String(value).trim();
		}
	}
	return "";
}

function readStudents(
	fileName: string,
	bytes: Buffer,
): { records: StudentWriteRecord[]; issues: ImportIssue[] } {
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
	const firstSheetName = workbook.SheetNames[0];
	const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
	if (!sheet) throw new Error("The workbook has no worksheets.");
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: "",
		raw: false,
		blankrows: false,
	});
	if (rows.length === 0) throw new Error("The worksheet has no student rows.");
	if (rows.length > MAX_STUDENT_ROWS) {
		throw new Error(
			`Upload at most ${MAX_STUDENT_ROWS.toLocaleString()} students at a time.`,
		);
	}
	const records: StudentWriteRecord[] = [];
	const issues: ImportIssue[] = [];
	rows.forEach((row, index) => {
		const statusText = cell(row, [
			"membership status",
			"member status",
			"status",
		]).toLowerCase();
		const values = {
			name: cell(row, ["name", "full name", "student name"]),
			email: cell(row, ["email", "email address", "student email"]),
			batch_year: cell(row, ["batch year", "batch", "year"]),
			college: cell(row, ["college", "college name", "university"]),
			department: cell(row, ["department", "dept", "branch"]),
			degree: cell(row, ["degree", "qualification"]),
			gender: cell(row, ["gender"]),
			membership_status: statusText || "current",
		};
		const parsed = studentMasterManualInputSchema.safeParse({
			fullName: values.name,
			email: values.email,
			batchYear: values.batch_year,
			collegeName: values.college,
			department: values.department,
			degree: values.degree,
			gender: values.gender,
			membershipStatus: values.membership_status,
		});
		if (parsed.success) {
			records.push(parsed.data);
		} else {
			issues.push({
				rowNumber: index + 2,
				messages: parsed.error.issues.map((issue) => issue.message),
				values,
			});
		}
	});
	return { records, issues };
}

export async function GET(request: Request) {
	try {
		await requireAdminMember();
		const search =
			new URL(request.url).searchParams.get("search")?.trim() ?? "";
		const filters = search
			? or(
					ilike(clubMembers.fullName, `%${search}%`),
					ilike(clubMembers.email, `%${search}%`),
					ilike(clubMembers.collegeName, `%${search}%`),
					ilike(clubMembers.department, `%${search}%`),
				)
			: undefined;
		const rows = await getDatabase()
			.select({
				id: clubMembers.id,
				fullName: clubMembers.fullName,
				email: clubMembers.email,
				batchYear: clubMembers.collegeYear,
				collegeName: clubMembers.collegeName,
				department: clubMembers.department,
				degree: clubMembers.degree,
				gender: clubMembers.gender,
				membershipStatus: clubMembers.membershipStatus,
				verifiedMember: clubMembers.verifiedMember,
				lastLoginAt: sql<string | null>`(
					select to_char(
						auth_user.last_sign_in_at at time zone 'UTC',
						'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
					)
					from auth.users as auth_user
					where auth_user.id = ${clubMembers.authUserId}
					limit 1
				)`,
			})
			.from(clubMembers)
			.where(filters)
			.orderBy(desc(clubMembers.createdAt))
			.limit(10_000);
		const result = studentMasterListSchema.safeParse({ students: rows });
		if (!result.success) throw new Error("Student roster data is invalid.");
		return NextResponse.json(result.data, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error: unknown) {
		return failure(error);
	}
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
		let records: StudentWriteRecord[];
		let issues: ImportIssue[] = [];
		if (request.headers.get("content-type")?.includes("application/json")) {
			const payload: unknown = await request.json();
			const parsed = studentMasterManualInputSchema.safeParse(payload);
			if (!parsed.success) {
				return NextResponse.json(
					{
						error:
							parsed.error.issues[0]?.message ?? "Student details are invalid.",
					},
					{ status: 400 },
				);
			}
			records = [parsed.data];
		} else {
			const form = await request.formData();
			const file = form.get("file");
			if (!(file instanceof File)) {
				return NextResponse.json(
					{ error: "Choose a student roster workbook." },
					{ status: 400 },
				);
			}
			if (file.size === 0 || file.size > MAX_FILE_BYTES) {
				return NextResponse.json(
					{ error: "Upload a non-empty file no larger than 10 MB." },
					{ status: 413 },
				);
			}
			try {
				const parsedFile = readStudents(
					file.name,
					Buffer.from(await file.arrayBuffer()),
				);
				records = parsedFile.records;
				issues = parsedFile.issues;
			} catch (error: unknown) {
				return NextResponse.json(
					{
						error:
							error instanceof Error
								? error.message
								: "The roster file is invalid.",
					},
					{ status: 400 },
				);
			}
		}
		const db = getDatabase();
		const savedIds =
			records.length === 0
				? []
				: await db.transaction(async (tx) => {
						const ids: string[] = [];
						for (const record of records) {
							const [saved] = await tx
								.insert(clubMembers)
								.values({
									fullName: record.fullName,
									email: record.email,
									collegeYear: record.batchYear,
									collegeName: record.collegeName,
									department: record.department,
									degree: record.degree,
									gender: record.gender,
									membershipStatus: record.membershipStatus,
									verifiedMember: record.membershipStatus !== "guest",
								})
								.onConflictDoUpdate({
									target: clubMembers.email,
									set: {
										fullName: record.fullName,
										collegeYear: record.batchYear,
										collegeName: record.collegeName,
										department: record.department,
										degree: record.degree,
										gender: record.gender,
										membershipStatus: record.membershipStatus,
										verifiedMember: record.membershipStatus !== "guest",
										updatedAt: new Date(),
									},
								})
								.returning({ id: clubMembers.id });
							if (saved) ids.push(saved.id);
						}
						return ids;
					});
		const result = studentMasterUploadResultSchema.safeParse({
			processed: savedIds.length,
			issueCount: issues.length,
			issues,
			students: records.map((record, index) => ({
				id: savedIds[index],
				fullName: record.fullName,
				email: record.email,
				batchYear: record.batchYear,
				collegeName: record.collegeName,
				department: record.department,
				degree: record.degree,
				gender: record.gender,
			})),
		});
		if (!result.success)
			throw new Error("The saved roster response is invalid.");
		return NextResponse.json(result.data, {
			status: 200,
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error: unknown) {
		return failure(error);
	}
}
