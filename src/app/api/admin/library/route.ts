import { createClient } from "@supabase/supabase-js";
import { count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberLibraryChunks, memberLibraryFiles } from "@/db/schema";
import {
	MEMBER_LIBRARY_MAX_BYTES,
	MemberLibraryFileError,
	parseMemberLibraryFile,
} from "@/lib/admin/memberLibrary";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import {
	memberLibraryDeleteSchema,
	memberLibraryListSchema,
	memberLibraryUploadResultSchema,
	memberLibraryUploadSchema,
} from "@/schemas/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "member-library";
const safeFilename = (value: string) =>
	Array.from(value.normalize("NFKC"), (character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint < 32 ||
			codePoint === 127 ||
			character === "/" ||
			character === "\\"
			? "-"
			: character;
	})
		.join("")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 240);

function storageAdminClient() {
	const { NEXT_PUBLIC_SUPABASE_URL } = getPublicSupabaseEnv();
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceKey)
		throw new Error("Server storage credentials are not configured.");
	return createClient(NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
}

function errorResponse(error: unknown) {
	if (error instanceof MemberAccessError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: error.status },
		);
	}
	if (error instanceof MemberLibraryFileError) {
		return NextResponse.json({ error: error.message }, { status: 400 });
	}
	console.error("[admin-library] Request failed.");
	return NextResponse.json(
		{ error: "The library request could not be completed." },
		{ status: 500 },
	);
}

export async function GET() {
	try {
		await requireAdminMember();
		const db = getDatabase();
		const rows = await db
			.select({
				id: memberLibraryFiles.id,
				originalFilename: memberLibraryFiles.originalFilename,
				contentType: memberLibraryFiles.contentType,
				fileSize: memberLibraryFiles.fileSize,
				processingStatus: memberLibraryFiles.processingStatus,
				aiEnabled: memberLibraryFiles.aiEnabled,
				collegeName: memberLibraryFiles.collegeName,
				createdAt: memberLibraryFiles.createdAt,
			})
			.from(memberLibraryFiles)
			.orderBy(desc(memberLibraryFiles.createdAt))
			.limit(200);
		const fileIds = rows.map((row) => row.id);
		const counts = fileIds.length
			? await db
					.select({ fileId: memberLibraryChunks.fileId, chunks: count() })
					.from(memberLibraryChunks)
					.where(inArray(memberLibraryChunks.fileId, fileIds))
					.groupBy(memberLibraryChunks.fileId)
			: [];
		const chunkCounts = new Map(counts.map((row) => [row.fileId, row.chunks]));
		const parsed = memberLibraryListSchema.safeParse({
			files: rows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
				chunkCount: chunkCounts.get(row.id) ?? 0,
			})),
		});
		if (!parsed.success) throw new Error("Library metadata failed validation.");
		return NextResponse.json(parsed.data, {
			headers: { "Cache-Control": "private, no-store" },
		});
	} catch (error: unknown) {
		return errorResponse(error);
	}
}

export async function POST(request: Request) {
	try {
		const { user } = await requireAdminMember();
		const origin = request.headers.get("origin");
		if (!origin || origin !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		const contentLengthHeader = request.headers.get("content-length");
		if (!contentLengthHeader) {
			return NextResponse.json(
				{ error: "Content length is required." },
				{ status: 411 },
			);
		}
		const contentLength = Number(contentLengthHeader);
		if (contentLength > MEMBER_LIBRARY_MAX_BYTES + 64_000) {
			return NextResponse.json(
				{ error: "Files must be 10 MB or smaller." },
				{ status: 413 },
			);
		}
		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File)) {
			return NextResponse.json(
				{ error: "Choose one file to add to the library." },
				{ status: 400 },
			);
		}
		if (file.size > MEMBER_LIBRARY_MAX_BYTES) {
			return NextResponse.json(
				{ error: "Files must be 10 MB or smaller." },
				{ status: 413 },
			);
		}
		const filename = safeFilename(file.name);
		if (!filename || filename === ".") {
			return NextResponse.json(
				{ error: "The file must have a supported filename." },
				{ status: 400 },
			);
		}
		const options = memberLibraryUploadSchema.safeParse({
			aiEnabled: formData.get("aiEnabled") === "true",
			collegeName: formData.get("collegeName") || null,
		});
		if (!options.success) {
			return NextResponse.json(
				{ error: "Check the library file settings." },
				{ status: 400 },
			);
		}
		let parsedFile: ReturnType<typeof parseMemberLibraryFile>;
		try {
			parsedFile = parseMemberLibraryFile(
				filename,
				Buffer.from(await file.arrayBuffer()),
			);
		} catch (error: unknown) {
			if (error instanceof MemberLibraryFileError) {
				return NextResponse.json({ error: error.message }, { status: 400 });
			}
			throw error;
		}

		const db = getDatabase();
		const [existing] = await db
			.select({ id: memberLibraryFiles.id })
			.from(memberLibraryFiles)
			.where(eq(memberLibraryFiles.sha256, parsedFile.sha256))
			.limit(1);
		if (existing) {
			return NextResponse.json(
				{ error: "This exact file is already in the library." },
				{ status: 409 },
			);
		}

		const id = crypto.randomUUID();
		const storagePath = `${id}/${filename}`;
		const storage = storageAdminClient();
		const { error: storageError } = await storage.storage
			.from(STORAGE_BUCKET)
			.upload(storagePath, file, {
				contentType: parsedFile.contentType,
				cacheControl: "0",
				upsert: false,
			});
		if (storageError)
			throw new Error("Unable to store the private original file.");

		try {
			const [storedFile] = await db
				.insert(memberLibraryFiles)
				.values({
					id,
					uploadedBy: user.id,
					originalFilename: filename,
					storagePath,
					contentType: parsedFile.contentType,
					fileSize: file.size,
					sha256: parsedFile.sha256,
					aiEnabled: options.data.aiEnabled,
					collegeName: options.data.collegeName,
				})
				.returning({
					id: memberLibraryFiles.id,
					originalFilename: memberLibraryFiles.originalFilename,
					contentType: memberLibraryFiles.contentType,
					fileSize: memberLibraryFiles.fileSize,
					processingStatus: memberLibraryFiles.processingStatus,
					aiEnabled: memberLibraryFiles.aiEnabled,
					collegeName: memberLibraryFiles.collegeName,
					createdAt: memberLibraryFiles.createdAt,
				});
			if (!storedFile) throw new Error("Unable to save library metadata.");
			await db
				.insert(memberLibraryChunks)
				.values(parsedFile.chunks.map((chunk) => ({ fileId: id, ...chunk })));
			const response = memberLibraryUploadResultSchema.safeParse({
				file: {
					...storedFile,
					createdAt: storedFile.createdAt.toISOString(),
					chunkCount: parsedFile.chunks.length,
				},
				duplicate: false,
			});
			if (!response.success)
				throw new Error("Stored library result is invalid.");
			return NextResponse.json(response.data, { status: 201 });
		} catch (error: unknown) {
			await db.delete(memberLibraryFiles).where(eq(memberLibraryFiles.id, id));
			await storage.storage.from(STORAGE_BUCKET).remove([storagePath]);
			throw error;
		}
	} catch (error: unknown) {
		return errorResponse(error);
	}
}

export async function DELETE(request: Request) {
	try {
		await requireAdminMember();
		const origin = request.headers.get("origin");
		if (!origin || origin !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{ error: "Invalid delete request." },
				{ status: 400 },
			);
		}
		const parsed = memberLibraryDeleteSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Choose a valid library file." },
				{ status: 400 },
			);
		}
		const db = getDatabase();
		const [file] = await db
			.select({
				id: memberLibraryFiles.id,
				storagePath: memberLibraryFiles.storagePath,
			})
			.from(memberLibraryFiles)
			.where(eq(memberLibraryFiles.id, parsed.data.id))
			.limit(1);
		if (!file)
			return NextResponse.json({ error: "File not found." }, { status: 404 });
		const { error } = await storageAdminClient()
			.storage.from(STORAGE_BUCKET)
			.remove([file.storagePath]);
		if (error) throw new Error("Unable to remove the private original file.");
		await db
			.delete(memberLibraryFiles)
			.where(eq(memberLibraryFiles.id, file.id));
		return NextResponse.json({ deleted: true });
	} catch (error: unknown) {
		return errorResponse(error);
	}
}
