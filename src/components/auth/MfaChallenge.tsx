"use client";

import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { totpCodeSchema } from "@/schemas/auth";

type MfaMode = "setup" | "verify";
type ScreenState = "loading" | "ready" | "busy" | "error";

function safeNextPath(value: string | null): string {
	return value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\")
		? value
		: "/";
}

/** Supabase returns an unescaped SVG data URL; Next Image needs a valid URL. */
function encodeQrCodeSource(value: string): string {
	const comma = value.indexOf(",");
	if (comma < 0 || !value.slice(0, comma).startsWith("data:image/svg+xml")) {
		return value.trimEnd();
	}
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value.slice(comma + 1))}`;
}

/** Enrolls a first TOTP factor or verifies an existing one to obtain AAL2. */
export function MfaChallenge({ mode }: { mode: MfaMode }) {
	const searchParams = useSearchParams();
	const nextPath = safeNextPath(searchParams.get("next"));
	const [screen, setScreen] = useState<ScreenState>("loading");
	const [factorId, setFactorId] = useState("");
	const [qrCode, setQrCode] = useState("");
	const [secret, setSecret] = useState("");
	const [code, setCode] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);

	useEffect(() => {
		let active = true;
		async function initialize() {
			const { data: userData } = await supabase.auth.getUser();
			if (!active) return;
			if (!userData.user) {
				window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
				return;
			}
			const { data: aalData } =
				await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
			if (!active) return;
			if (aalData?.currentLevel === "aal2") {
				window.location.replace(nextPath);
				return;
			}
			const { data: factorData, error: factorError } =
				await supabase.auth.mfa.listFactors();
			if (!active) return;
			if (factorError) {
				if (active) {
					setError(
						"Could not load your authenticator status. Refresh and try again.",
					);
					setScreen("error");
				}
				return;
			}
			const verified = factorData.totp.find(
				(factor) => factor.status === "verified",
			);
			if (mode === "verify") {
				if (!verified) {
					window.location.replace(
						`/auth/mfa/setup?next=${encodeURIComponent(nextPath)}`,
					);
					return;
				}
				if (active) {
					setFactorId(verified.id);
					setScreen("ready");
				}
				return;
			}
			if (verified) {
				window.location.replace(
					`/auth/mfa/verify?next=${encodeURIComponent(nextPath)}`,
				);
				return;
			}
			const pending = factorData.all.find(
				(factor) =>
					factor.factor_type === "totp" && factor.status === "unverified",
			);
			if (pending) {
				const { error: removeError } = await supabase.auth.mfa.unenroll({
					factorId: pending.id,
				});
				if (!active) return;
				if (removeError) {
					if (active) {
						setError(
							"There is an unfinished authenticator setup. Contact a club administrator to reset it.",
						);
						setScreen("error");
					}
					return;
				}
			}
			const { data: enrollment, error: enrollError } =
				await supabase.auth.mfa.enroll({
					factorType: "totp",
					friendlyName: "DeScience OS Authenticator",
					issuer: "DeScience Open Source Club",
				});
			if (!active) return;
			if (enrollError || enrollment.type !== "totp") {
				if (active) {
					setError(
						"Authenticator setup could not start. Refresh and try again.",
					);
					setScreen("error");
				}
				return;
			}
			if (active) {
				setFactorId(enrollment.id);
				setQrCode(encodeQrCodeSource(enrollment.totp.qr_code));
				setSecret(enrollment.totp.secret);
				setScreen("ready");
			}
		}
		void initialize();
		return () => {
			active = false;
		};
	}, [mode, nextPath, supabase]);

	async function verifyFactor(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setMessage("");
		const parsedCode = totpCodeSchema.safeParse(code);
		if (!parsedCode.success) {
			setError(
				parsedCode.error.issues[0]?.message ?? "Enter the 6-digit code.",
			);
			return;
		}
		setScreen("busy");
		const { data: challenge, error: challengeError } =
			await supabase.auth.mfa.challenge({ factorId });
		if (challengeError) {
			setError(
				"Could not start authenticator verification. Request a new code and retry.",
			);
			setScreen("ready");
			return;
		}
		const { error: verifyError } = await supabase.auth.mfa.verify({
			factorId,
			challengeId: challenge.id,
			code: parsedCode.data,
		});
		if (verifyError) {
			setError(
				"That authenticator code was not accepted. Check your device time and try the current code.",
			);
			setCode("");
			setScreen("ready");
			return;
		}
		setMessage(
			"Two-step verification complete. Opening your member workspace…",
		);
		window.location.assign(nextPath);
	}

	async function signOut() {
		await supabase.auth.signOut();
		window.location.assign("/");
	}

	const busy = screen === "busy";
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
						Required account protection
					</p>
					<h1 className="mt-2 text-2xl font-semibold">
						{mode === "setup"
							? "Set up your authenticator"
							: "Verify your authenticator"}
					</h1>
					{screen === "loading" && (
						<p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
							<LoaderCircle size={16} className="animate-spin" /> Checking your
							member access…
						</p>
					)}
					{mode === "setup" && qrCode && screen !== "loading" && (
						<div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
							<p>
								Scan this QR code in an authenticator app such as Google
								Authenticator, Microsoft Authenticator, or 1Password.
							</p>
							<div className="mx-auto w-fit rounded-2xl bg-white p-3">
								<Image
									src={qrCode}
									alt="Authenticator enrollment QR code"
									width={192}
									height={192}
									unoptimized
								/>
							</div>
							<details className="rounded-xl border border-white/10 bg-black/20 p-3">
								<summary className="cursor-pointer text-cyan-100">
									Can’t scan the QR code?
								</summary>
								<p className="mt-2 break-all font-mono text-xs text-slate-300">
									{secret}
								</p>
							</details>
							<p>
								Enter the 6-digit code from the app to finish enrollment. The
								code is never stored by Hack OS.
							</p>
						</div>
					)}
					{mode === "verify" && screen !== "loading" && (
						<p className="mt-3 text-sm leading-6 text-slate-400">
							Enter the current 6-digit code from your authenticator app.
						</p>
					)}
					{screen !== "loading" && screen !== "error" && (
						<form className="mt-6 space-y-4" onSubmit={verifyFactor}>
							<label
								htmlFor="totp-code"
								className="block text-sm text-slate-300"
							>
								Authenticator code
							</label>
							<input
								id="totp-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{6}"
								maxLength={6}
								required
								value={code}
								onChange={(event) =>
									setCode(
										event.currentTarget.value.replace(/\D/g, "").slice(0, 6),
									)
								}
								disabled={busy}
								className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 font-mono tracking-[0.35em] outline-none focus:border-cyan-200/50"
								placeholder="000000"
							/>
							{error && (
								<p role="alert" className="text-sm text-rose-300">
									{error}
								</p>
							)}
							{message && (
								<p aria-live="polite" className="text-sm text-cyan-100">
									{message}
								</p>
							)}
							<button
								type="submit"
								disabled={busy || screen !== "ready"}
								className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-100 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
							>
								{busy && <LoaderCircle size={17} className="animate-spin" />}
								{busy
									? "Verifying…"
									: mode === "setup"
										? "Enable two-step verification"
										: "Verify and continue"}
							</button>
						</form>
					)}
					{error && screen === "error" && (
						<p role="alert" className="mt-5 text-sm text-rose-300">
							{error}
						</p>
					)}
					<button
						type="button"
						onClick={signOut}
						className="mt-5 w-full text-sm text-slate-500 hover:text-white"
					>
						Sign out
					</button>
				</section>
			</div>
		</main>
	);
}
