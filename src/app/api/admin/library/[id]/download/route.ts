import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { memberLibraryFiles } from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

const libraryIdSchema = z.string().uuid();

/** Authenticated admins receive a short-lived signed URL for private originals. */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdminMember();
		const { id: rawId } = await params;
		const parsedId = libraryIdSchema.safeParse(rawId);
		if (!parsedId.success) {
			return NextResponse.json(
				{ error: "Invalid library file." },
				{ status: 400 },
			);
		}
		const [file] = await getDatabase()
			.select({
				storagePath: memberLibraryFiles.storagePath,
				originalFilename: memberLibraryFiles.originalFilename,
			})
			.from(memberLibraryFiles)
			.where(eq(memberLibraryFiles.id, parsedId.data))
			.limit(1);
		if (!file)
			return NextResponse.json({ error: "File not found." }, { status: 404 });

		const { NEXT_PUBLIC_SUPABASE_URL } = getPublicSupabaseEnv();
		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceKey) throw new Error("Private storage is not configured.");
		const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
		const { data, error } = await supabase.storage
			.from("member-library")
			.createSignedUrl(file.storagePath, 60, {
				download: file.originalFilename,
			});
		if (error || !data?.signedUrl)
			throw new Error("Unable to sign private file URL.");
		return NextResponse.redirect(data.signedUrl, {
			status: 302,
			headers: { "Cache-Control": "private, no-store" },
		});
	} catch (error: unknown) {
		if (error instanceof MemberAccessError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}
		console.error("[admin-library] Download request failed.");
		return NextResponse.json(
			{ error: "Unable to download this private file." },
			{ status: 500 },
		);
	}
}
