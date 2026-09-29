import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { emailOtpRequestSchema } from "@/schemas/auth";

const accessCheckSchema = z.object({ eligible: z.boolean() }).strict();
const acceptedResponse = {
	message:
		"If this is an approved DeScience account, a sign-in code will arrive shortly.",
} as const;

/** Checks the private roster and existing administrator role before email is sent. */
export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Enter a valid email address." },
			{ status: 400, headers: { "Cache-Control": "no-store" } },
		);
	}
	const parsedRequest = emailOtpRequestSchema.safeParse(body);
	if (!parsedRequest.success) {
		return NextResponse.json(
			{
				error:
					parsedRequest.error.issues[0]?.message ??
					"Enter a valid email address.",
			},
			{ status: 400, headers: { "Cache-Control": "no-store" } },
		);
	}

	try {
		const rows = await getDatabase().execute(sql`
			select (
				exists (
					select 1
					from public.club_members
					where lower(email) = ${parsedRequest.data.email}
						and verified_member = true
						and membership_status in ('current', 'alumnus', 'mentor')
						and length(trim(full_name)) > 0
						and length(trim(college_name)) > 0
						and length(trim(college_year)) > 0
						and length(trim(department)) > 0
						and length(trim(degree)) > 0
						and gender is not null
						and length(trim(gender)) > 0
				)
				or exists (
					select 1
					from auth.users as auth_user
					inner join public.users as profile on profile.id = auth_user.id
					where lower(auth_user.email) = ${parsedRequest.data.email}
						and profile.role = 'admin'
				)
			) as eligible
		`);
		const accessResult = accessCheckSchema.safeParse(rows[0]);
		if (!accessResult.success) {
			console.error("[auth] Email access check returned an invalid result.");
			return NextResponse.json(
				{ error: "Sign-in is temporarily unavailable. Try again shortly." },
				{ status: 503, headers: { "Cache-Control": "no-store" } },
			);
		}
		if (!accessResult.data.eligible) {
			return NextResponse.json(
				{
					error:
						"Only DeScience Open Source Club members can access this platform. If you are a member, contact an administrator to update the student master list.",
				},
				{ status: 403, headers: { "Cache-Control": "no-store" } },
			);
		}

		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!supabaseUrl || !supabaseAnonKey)
			throw new Error("Supabase authentication is not configured.");

		const supabase = createClient(supabaseUrl, supabaseAnonKey, {
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		});
		const { error } = await supabase.auth.signInWithOtp({
			email: parsedRequest.data.email,
			options: { shouldCreateUser: true },
		});
		if (error) {
			console.error("[auth] Approved-account OTP delivery failed.");
			return NextResponse.json(acceptedResponse, {
				status: 202,
				headers: { "Cache-Control": "no-store" },
			});
		}

		return NextResponse.json(acceptedResponse, {
			status: 202,
			headers: { "Cache-Control": "no-store" },
		});
	} catch {
		console.error("[auth] Member access check or OTP request failed.");
		return NextResponse.json(
			{ error: "Sign-in is temporarily unavailable. Try again shortly." },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		);
	}
}
