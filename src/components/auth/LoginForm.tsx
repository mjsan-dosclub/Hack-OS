"use client";

import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emailOtpRequestSchema, emailOtpVerifySchema } from "@/schemas/auth";

function safeNextPath(value: string | null): string {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: "/";
}

export default function LoginPage() {
	const searchParams = useSearchParams();
	const nextPath = safeNextPath(searchParams.get("next"));
	const [email, setEmail] = useState("");
	const [token, setToken] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);

	async function requestCode(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");
		setError("");
		const parsed = emailOtpRequestSchema.safeParse({ email });
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
			return;
		}
		setBusy(true);
		const { error: authError } = await supabase.auth.signInWithOtp({
			email: parsed.data.email,
			// Member access is matched to the preloaded roster. Admin access is
			// granted separately through the trusted application role.
			options: { shouldCreateUser: true },
		});
		setBusy(false);
		if (authError) {
			// Avoid disclosing whether an address is in the club roster.
			setMessage(
				"If this is an approved DeScience account, a sign-in code will arrive shortly.",
			);
			setCodeSent(true);
			return;
		}
		setCodeSent(true);
		setMessage(
			"If this is an approved DeScience account, a sign-in code will arrive shortly.",
		);
	}

	async function verifyCode(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");
		setError("");
		const parsed = emailOtpVerifySchema.safeParse({ email, token });
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check the email and code.");
			return;
		}
		setBusy(true);
		const { error: authError } = await supabase.auth.verifyOtp({
			email: parsed.data.email,
			token: parsed.data.token,
			type: "email",
		});
		setBusy(false);
		if (authError) {
			setError(
				"That code could not be verified. Request a fresh code and try again.",
			);
			return;
		}
		window.location.assign(nextPath);
	}

	return (
		<main className="os-standalone-screen min-h-dvh bg-[#080d14] px-5 py-12 text-slate-100">
			<div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center">
				<a
					href="/"
					className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-slate-400 hover:text-white"
				>
					<ArrowLeft size={16} /> Back to public desktop
				</a>
				<section className="rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-cyan-950/20">
					<div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
						<ShieldCheck size={23} />
					</div>
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
						DeScience member access
					</p>
					<h1 className="mt-2 text-2xl font-semibold">
						Sign in without a password
					</h1>
					<p className="mt-2 text-sm leading-6 text-slate-400">
						Use the email address approved for your DeScience account. Member
						and admin access also require an authenticator app.
					</p>
					<form
						className="mt-7 space-y-4"
						onSubmit={codeSent ? verifyCode : requestCode}
					>
						<label
							className="block text-sm text-slate-300"
							htmlFor="member-email"
						>
							DeScience account email
						</label>
						<div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-cyan-200/50">
							<Mail size={17} className="text-slate-500" />
							<input
								id="member-email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(event) => setEmail(event.currentTarget.value)}
								disabled={busy || codeSent}
								className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600 disabled:text-slate-400"
								placeholder="you@university.edu"
							/>
						</div>
						{codeSent && (
							<>
								<label
									className="block text-sm text-slate-300"
									htmlFor="email-code"
								>
									8-digit email code
								</label>
								<input
									id="email-code"
									inputMode="numeric"
									autoComplete="one-time-code"
									pattern="[0-9]{8}"
									maxLength={8}
									required
									value={token}
									onChange={(event) =>
										setToken(
											event.currentTarget.value.replace(/\D/g, "").slice(0, 8),
										)
									}
									className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 font-mono tracking-[0.35em] outline-none focus:border-cyan-200/50"
									placeholder="00000000"
								/>
							</>
						)}
						{message && (
							<p aria-live="polite" className="text-sm text-cyan-100">
								{message}
							</p>
						)}
						{error && (
							<p role="alert" className="text-sm text-rose-300">
								{error}
							</p>
						)}
						<button
							type="submit"
							disabled={busy}
							className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-100 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
						>
							{busy ? (
								<LoaderCircle size={17} className="animate-spin" />
							) : null}
							{busy
								? "Working…"
								: codeSent
									? "Verify code and continue"
									: "Send sign-in code"}
						</button>
						{codeSent && (
							<button
								type="button"
								onClick={() => {
									setCodeSent(false);
									setToken("");
									setMessage("");
									setError("");
								}}
								className="w-full text-sm text-slate-400 hover:text-white"
							>
								Use a different email
							</button>
						)}
					</form>
				</section>
			</div>
		</main>
	);
}
