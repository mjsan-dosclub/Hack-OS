import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberActivityEvents } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { memberAccessSchema } from "@/schemas/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activitySchema = z
	.object({ activity: z.enum(["teammate_match", "project_plan"]) })
	.strict();

/** Records an authenticated student's successful feature use without content. */
export async function POST(request: Request): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid activity request." },
			{ status: 400 },
		);
	}
	const parsed = activitySchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json(
			{ error: "Invalid activity type." },
			{ status: 400 },
		);

	const supabase = await createSupabaseServerClient();
	const { data: identity, error: identityError } =
		await supabase.auth.getUser();
	if (identityError || !identity.user)
		return NextResponse.json(
			{ error: "Sign in to continue." },
			{ status: 401 },
		);

	const { data, error } = await supabase.rpc("current_member_access");
	const accessRow = Array.isArray(data) ? data[0] : data;
	const access = memberAccessSchema.safeParse(accessRow);
	if (error || !access.success)
		return NextResponse.json(
			{ error: "Could not verify account access." },
			{ status: 503 },
		);
	if (!access.data.verified_member && !access.data.is_admin)
		return NextResponse.json(
			{ error: "Verified club access is required." },
			{ status: 403 },
		);

	const { data: assurance, error: assuranceError } =
		await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (assuranceError || assurance.currentLevel !== "aal2")
		return NextResponse.json(
			{ error: "Complete authenticator verification." },
			{ status: 403 },
		);

	try {
		await getDatabase().insert(memberActivityEvents).values({
			userId: identity.user.id,
			activity: parsed.data.activity,
		});
		return new Response(null, {
			status: 204,
			headers: { "Cache-Control": "no-store" },
		});
	} catch {
		return NextResponse.json(
			{ error: "Could not record feature use." },
			{ status: 503 },
		);
	}
}
