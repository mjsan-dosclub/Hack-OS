"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";

/** Browser client uses only the public anon key; all privileged work stays server-side. */
export function createSupabaseBrowserClient() {
	const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
		getPublicSupabaseEnv();
	return createBrowserClient(
		NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY,
	);
}
