import { z } from "zod";

const publicSupabaseEnvSchema = z
	.object({
		NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
		NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
	})
	.strict();

/** Fail early with a useful configuration error without logging credential values. */
export function getPublicSupabaseEnv() {
	const parsed = publicSupabaseEnvSchema.safeParse({
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	});
	if (!parsed.success) {
		throw new Error(
			"Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before using member authentication.",
		);
	}
	return parsed.data;
}
