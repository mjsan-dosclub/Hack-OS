import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bucket = "hackathon-banners";
const maxBytes = 5 * 1024 * 1024;
const imageTypes = new Map([
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
	["image/avif", "avif"],
]);

export async function POST(request: Request) {
	try {
		await requireAdminMember();
		if (request.headers.get("origin") !== new URL(request.url).origin) {
			return NextResponse.json(
				{ error: "Origin check failed." },
				{ status: 403 },
			);
		}
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return NextResponse.json(
				{ error: "Choose an image file." },
				{ status: 400 },
			);
		}
		const extension = imageTypes.get(file.type);
		if (!extension)
			return NextResponse.json(
				{ error: "Use PNG, JPG, WebP, or AVIF." },
				{ status: 415 },
			);
		if (file.size < 1 || file.size > maxBytes)
			return NextResponse.json(
				{ error: "Banner images must be between 1 byte and 5 MB." },
				{ status: 413 },
			);

		const { NEXT_PUBLIC_SUPABASE_URL } = getPublicSupabaseEnv();
		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceKey) throw new Error("Banner storage is not configured.");
		const storage = createClient(NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
		const path = `${crypto.randomUUID()}.${extension}`;
		const { error } = await storage.storage.from(bucket).upload(path, file, {
			contentType: file.type,
			cacheControl: "3600",
			upsert: false,
		});
		if (error)
			throw new Error(
				"Banner upload failed. Confirm the storage migration ran.",
			);
		const { data } = storage.storage.from(bucket).getPublicUrl(path);
		return NextResponse.json({ url: data.publicUrl }, { status: 201 });
	} catch (error: unknown) {
		if (error instanceof MemberAccessError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}
		console.error("[event-banner] Upload failed.");
		return NextResponse.json(
			{ error: "Banner upload is unavailable." },
			{ status: 500 },
		);
	}
}
