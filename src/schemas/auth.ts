import { z } from "zod";

/** Normalize only whitespace; the auth provider owns actual email canonicalization. */
export const memberEmailSchema = z
	.string()
	.trim()
	.email("Enter a valid email address.")
	.max(254)
	.transform((email) => email.toLowerCase());

export const emailOtpRequestSchema = z
	.object({ email: memberEmailSchema })
	.strict();

export const emailOtpRequestResponseSchema = z
	.object({
		message: z.string().min(1),
	})
	.strict();

export const emailOtpRequestErrorSchema = z
	.object({ error: z.string().min(1) })
	.strict();

export const emailOtpVerifySchema = z
	.object({
		email: memberEmailSchema,
		token: z
			.string()
			.trim()
			.regex(/^\d{8}$/, "Enter the 8-digit email code."),
	})
	.strict();

export const totpCodeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, "Enter the 6-digit authenticator code.");

export const memberAccessSchema = z
	.object({
		verified_member: z.boolean(),
		membership_status: z
			.enum(["current", "alumnus", "mentor", "guest"])
			.nullable(),
		is_admin: z.boolean(),
	})
	.strict();

export const memberAccessActionSchema = z.enum(["setup_mfa", "verify_mfa"]);

export type MemberEmail = z.infer<typeof memberEmailSchema>;
export type MemberAccess = z.infer<typeof memberAccessSchema>;
