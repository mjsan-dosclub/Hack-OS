import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { emailOtpRequestSchema } from "@/schemas/auth";

const accessCheckSchema = z
	.object({
		eligible: z.boolean(),
		auth_user_id: z.string().uuid().nullable(),
		member_name: z.string().nullable(),
		member_college: z.string().nullable(),
	})
	.strict();
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
			with matched_member as (
				select full_name, college_name
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
				limit 1
			)
			select (
				exists (
					select 1 from matched_member
				)
				or exists (
					select 1
					from auth.users as auth_user
					inner join public.users as profile on profile.id = auth_user.id
					where lower(auth_user.email) = ${parsedRequest.data.email}
						and profile.role = 'admin'
				)
			) as eligible,
			(select id::text from auth.users where lower(email) = ${parsedRequest.data.email} limit 1) as auth_user_id,
			(select full_name from matched_member) as member_name,
			(select college_name from matched_member) as member_college
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
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey)
			throw new Error("Supabase authentication is not configured.");

		// First-time members are provisioned only after the private roster check.
		// Confirming the Auth identity here makes the OTP flow use the Magic Link
		// template instead of Supabase's separate Confirm Signup email template.
		if (accessResult.data.member_name && accessResult.data.member_college) {
			const admin = createClient(supabaseUrl, supabaseServiceKey, {
				auth: {
					autoRefreshToken: false,
					detectSessionInUrl: false,
					persistSession: false,
				},
			});
			let authUserId = accessResult.data.auth_user_id;
			if (!authUserId) {
				const { data, error } = await admin.auth.admin.createUser({
					email: parsedRequest.data.email,
					email_confirm: true,
				});
				if (error || !data.user) {
					// Another request may have created the same account concurrently.
					const racedUser = await getDatabase().execute(sql`
						select id::text from auth.users
						where lower(email) = ${parsedRequest.data.email}
						limit 1
					`);
					const racedUserId = z.string().uuid().safeParse(racedUser[0]?.id);
					if (!racedUserId.success) {
						console.error(
							"[auth] Approved member account provisioning failed.",
						);
						return NextResponse.json(acceptedResponse, {
							status: 202,
							headers: { "Cache-Control": "no-store" },
						});
					}
					authUserId = racedUserId.data;
				} else {
					authUserId = data.user.id;
				}
			}
			// A previous failed first-login attempt may have left an unconfirmed
			// Auth identity behind. Confirm it now so it cannot trigger signup mail.
			const { error: confirmationError } =
				await admin.auth.admin.updateUserById(authUserId, {
					email_confirm: true,
				});
			if (confirmationError) {
				console.error("[auth] Approved member confirmation failed.");
				return NextResponse.json(acceptedResponse, {
					status: 202,
					headers: { "Cache-Control": "no-store" },
				});
			}
			// Older Auth accounts may predate the roster-linking trigger. Link only
			// the already-verified email's own roster row, and never steal a link.
			const linkedMember = await getDatabase().execute(sql`
				update public.club_members
				set auth_user_id = ${authUserId}::uuid
				where lower(email) = ${parsedRequest.data.email}
					and verified_member = true
					and membership_status in ('current', 'alumnus', 'mentor')
					and (auth_user_id is null or auth_user_id = ${authUserId}::uuid)
				returning id
			`);
			if (linkedMember.length === 0) {
				console.error(
					"[auth] Approved member roster link could not be confirmed.",
				);
				return NextResponse.json(acceptedResponse, {
					status: 202,
					headers: { "Cache-Control": "no-store" },
				});
			}

			// The original auth.users trigger links the roster row. Create the
			// matching public profile for first-time members without changing roles.
			await getDatabase().execute(sql`
				insert into public.users (id, display_name, university, role)
				values (${authUserId}::uuid, ${accessResult.data.member_name}, ${accessResult.data.member_college}, 'member')
				on conflict (id) do nothing
			`);
		}

		const supabase = createClient(supabaseUrl, supabaseAnonKey, {
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		});
		const { error } = await supabase.auth.signInWithOtp({
			email: parsedRequest.data.email,
			options: { shouldCreateUser: false },
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
