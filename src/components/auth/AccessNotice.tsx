"use client";

import { LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AccessNotice({ kind }: { kind: "not-member" | "denied" }) {
	const heading =
		kind === "not-member"
			? "Member access is limited"
			: "Administrator access required";
	const description =
		kind === "not-member"
			? "This workspace is for verified current and past DeScience Open Source Club members. Public hackathon discovery remains available from the desktop."
			: "This area is restricted to club administrators. If you need access for your role, contact a club administrator.";
	async function signOut() {
		await createSupabaseBrowserClient().auth.signOut();
		window.location.assign("/");
	}
	return (
		<main className="os-standalone-screen grid min-h-dvh place-items-center bg-[#080d14] px-5 text-slate-100">
			<section className="max-w-lg rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center">
				<div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-100">
					<LockKeyhole size={21} />
				</div>
				<h1 className="text-2xl font-semibold">{heading}</h1>
				<p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
				<div className="mt-6 flex flex-wrap justify-center gap-3">
					<a
						href="/"
						className="rounded-xl bg-cyan-100 px-4 py-2.5 text-sm font-semibold text-slate-950"
					>
						Return to desktop
					</a>
					<button
						type="button"
						onClick={signOut}
						className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:text-white"
					>
						Sign out
					</button>
				</div>
			</section>
		</main>
	);
}
