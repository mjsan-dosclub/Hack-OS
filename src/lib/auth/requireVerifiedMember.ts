import { memberAccessSchema } from "@/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class MemberAccessError extends Error {
	constructor(
		message: string,
		readonly status: 401 | 403 | 503,
	) {
		super(message);
		this.name = "MemberAccessError";
	}
}

/** Re-checks identity, roster verification, and AAL2 inside sensitive handlers. */
export async function requireVerifiedMember() {
	const supabase = await createSupabaseServerClient();
	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) {
		throw new MemberAccessError("Sign in to continue.", 401);
	}

	const { data: accessData, error: accessError } = await supabase.rpc(
		"current_member_access",
	);
	const accessRow = Array.isArray(accessData) ? accessData[0] : accessData;
	const accessResult = memberAccessSchema.safeParse(accessRow);
	if (accessError || !accessResult.success) {
		throw new MemberAccessError("Unable to verify club membership.", 503);
	}
	if (!accessResult.data.verified_member) {
		throw new MemberAccessError("Verified club membership is required.", 403);
	}
	const { data: assurance, error: assuranceError } =
		await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (assuranceError) {
		throw new MemberAccessError(
			"Unable to verify two-step authentication.",
			503,
		);
	}
	if (assurance.currentLevel !== "aal2") {
		throw new MemberAccessError(
			"Complete authenticator verification to continue.",
			403,
		);
	}
	return { user: userData.user, access: accessResult.data };
}

/** Admin route guard repeats the role check; middleware is not the only boundary. */
export async function requireAdminMember() {
	const supabase = await createSupabaseServerClient();
	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) {
		throw new MemberAccessError("Sign in to continue.", 401);
	}
	const { data: accessData, error: accessError } = await supabase.rpc(
		"current_member_access",
	);
	const accessRow = Array.isArray(accessData) ? accessData[0] : accessData;
	const accessResult = memberAccessSchema.safeParse(accessRow);
	if (accessError || !accessResult.success) {
		throw new MemberAccessError("Unable to verify administrator access.", 503);
	}
	if (!accessResult.data.is_admin) {
		throw new MemberAccessError("Administrator access is required.", 403);
	}
	const { data: assurance, error: assuranceError } =
		await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
	if (assuranceError) {
		throw new MemberAccessError(
			"Unable to verify two-step authentication.",
			503,
		);
	}
	if (assurance.currentLevel !== "aal2") {
		throw new MemberAccessError(
			"Complete authenticator verification to continue.",
			403,
		);
	}
	return { user: userData.user, access: accessResult.data };
}
