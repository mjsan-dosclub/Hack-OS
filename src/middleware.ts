import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { memberAccessSchema } from "./schemas/auth";
import { getPublicSupabaseEnv } from "./lib/supabase/env";

const MEMBER_PATHS = ["/members", "/apps/synergy", "/api/synergy"];
const ADMIN_PATHS = ["/admin", "/api/admin"];

function matchesPath(pathname: string, roots: string[]): boolean {
	return roots.some(
		(root) => pathname === root || pathname.startsWith(`${root}/`),
	);
}

/** Refreshes auth cookies and enforces member verification plus Supabase AAL2. */
export async function middleware(request: NextRequest) {
	let response = NextResponse.next({ request });
	const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
		getPublicSupabaseEnv();
	const supabase = createServerClient(
		NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => request.cookies.getAll(),
				setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					response = NextResponse.next({ request });
					for (const { name, value, options } of cookiesToSet) {
						response.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	const pathname = request.nextUrl.pathname;
	const needsMember = matchesPath(pathname, MEMBER_PATHS);
	const needsAdmin = matchesPath(pathname, ADMIN_PATHS);
	if (!needsMember && !needsAdmin) return response;

	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) {
		if (pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Authentication required." },
				{ status: 401 },
			);
		}
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
		return NextResponse.redirect(loginUrl);
	}

	const { data: accessData, error: accessError } = await supabase.rpc(
		"current_member_access",
	);
	const accessRow = Array.isArray(accessData) ? accessData[0] : accessData;
	const accessResult = memberAccessSchema.safeParse(accessRow);
	if (accessError || !accessResult.success) {
		return NextResponse.json(
			{ error: "Unable to verify club membership." },
			{ status: 503 },
		);
	}
	const access = accessResult.data;

	if (needsAdmin && (!access.is_admin || !access.verified_member)) {
		return pathname.startsWith("/api/")
			? NextResponse.json(
					{ error: "Administrator access required." },
					{ status: 403 },
				)
			: NextResponse.redirect(new URL("/auth/denied", request.url));
	}
	if (needsMember && !access.verified_member) {
		return pathname.startsWith("/api/")
			? NextResponse.json(
					{ error: "Verified club membership required." },
					{ status: 403 },
				)
			: NextResponse.redirect(new URL("/auth/not-member", request.url));
	}

	const { data: assurance, error: assuranceError } =
		await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (assuranceError) {
		return NextResponse.json(
			{ error: "Unable to verify multi-factor authentication." },
			{ status: 503 },
		);
	}
	if (assurance.currentLevel !== "aal2") {
		if (pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Two-step verification required." },
				{ status: 403 },
			);
		}
		const { data: factors } = await supabase.auth.mfa.listFactors();
		const hasVerifiedTotp = factors?.totp.some(
			(factor) => factor.status === "verified",
		);
		const mfaUrl = request.nextUrl.clone();
		mfaUrl.pathname = hasVerifiedTotp ? "/auth/mfa/verify" : "/auth/mfa/setup";
		mfaUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
		return NextResponse.redirect(mfaUrl);
	}

	return response;
}

export const config = {
	matcher: [
		"/members/:path*",
		"/apps/synergy/:path*",
		"/api/synergy/:path*",
		"/admin/:path*",
		"/api/admin/:path*",
	],
};
