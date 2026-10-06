"use client";

import {
	Activity,
	BookOpen,
	Check,
	ChevronDown,
	Command,
	ExternalLink,
	Globe2,
	LogIn,
	LogOut,
	Palette,
	RefreshCw,
	Settings2,
	Terminal,
	Type,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	DesktopFontFamily,
	DesktopFontSize,
	DesktopTheme,
} from "@/hooks/useDesktopAppearance";
import { useWindowManager } from "@/stores/useWindowManager";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { memberAccessSchema } from "@/schemas/auth";

export type ClockMode = "12h" | "24h";

interface MenuBarProps {
	clockMode: ClockMode;
	onClockModeChange: (mode: ClockMode) => void;
	onOpenTerminal: () => void;
	onOpenHelp: () => void;
	onOpenPalette: () => void;
	theme: DesktopTheme;
	onThemeChange: (theme: DesktopTheme) => void;
	fontSize: DesktopFontSize;
	onFontSizeChange: (size: DesktopFontSize) => void;
	fontFamily: DesktopFontFamily;
	onFontFamilyChange: (family: DesktopFontFamily) => void;
}

const CLUB_URL = "https://descienceosclub.com/";
const GITHUB_SEARCH_URL =
	"https://github.com/search?q=DeScience+Open+Source+Club&type=orgs";

export function MenuBar({
	clockMode,
	onClockModeChange,
	onOpenTerminal,
	onOpenHelp,
	onOpenPalette,
	theme,
	onThemeChange,
	fontSize,
	onFontSizeChange,
	fontFamily,
	onFontFamilyChange,
}: MenuBarProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [clock, setClock] = useState("");
	const [online, setOnline] = useState(true);
	const [fps, setFps] = useState<number | null>(null);
	const [memberEmail, setMemberEmail] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [authReady, setAuthReady] = useState(false);
	const [signOutError, setSignOutError] = useState("");
	const menuRef = useRef<HTMLDivElement>(null);
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);
	const activeTitle = useWindowManager(
		(state) =>
			state.windows.find((item) => item.id === state.activeWindowId)?.title ??
			"Desktop",
	);

	useEffect(() => {
		function updateClock() {
			setClock(
				new Intl.DateTimeFormat("en", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
					hour12: clockMode === "12h",
				}).format(new Date()),
			);
		}
		function updateNetwork() {
			setOnline(navigator.onLine);
		}
		updateClock();
		updateNetwork();
		const clockTimer = window.setInterval(updateClock, 1000);
		window.addEventListener("online", updateNetwork);
		window.addEventListener("offline", updateNetwork);

		let frameId = 0;
		let frameCount = 0;
		let sampleStart = performance.now();
		function sampleFrame(now: number) {
			frameCount += 1;
			const elapsed = now - sampleStart;
			if (elapsed >= 1000) {
				setFps(Math.round((frameCount * 1000) / elapsed));
				frameCount = 0;
				sampleStart = now;
			}
			frameId = window.requestAnimationFrame(sampleFrame);
		}
		frameId = window.requestAnimationFrame(sampleFrame);

		function closeMenuOnOutside(event: PointerEvent) {
			if (
				event.target instanceof Node &&
				menuRef.current &&
				!menuRef.current.contains(event.target)
			)
				setMenuOpen(false);
		}
		document.addEventListener("pointerdown", closeMenuOnOutside);
		return () => {
			window.clearInterval(clockTimer);
			window.removeEventListener("online", updateNetwork);
			window.removeEventListener("offline", updateNetwork);
			window.cancelAnimationFrame(frameId);
			document.removeEventListener("pointerdown", closeMenuOnOutside);
		};
	}, [clockMode]);

	useEffect(() => {
		const { data } = supabase.auth.onAuthStateChange((_event, session) => {
			setMemberEmail(session?.user.email ?? null);
			setIsAdmin(false);
			setAuthReady(true);
			setSignOutError("");
			if (session) {
				void supabase
					.rpc("current_member_access")
					.then(({ data: accessData }) => {
						const row = Array.isArray(accessData) ? accessData[0] : accessData;
						const access = memberAccessSchema.safeParse(row);
						setIsAdmin(access.success && access.data.is_admin);
					});
			}
		});
		return () => data.subscription.unsubscribe();
	}, [supabase]);

	async function signOut(): Promise<void> {
		setSignOutError("");
		const { error } = await supabase.auth.signOut();
		if (error) {
			setSignOutError("Sign out failed. Please try again.");
			return;
		}
		setMenuOpen(false);
		window.location.assign("/");
	}

	return (
		<header className="absolute inset-x-0 top-0 z-[500] flex h-11 items-center justify-between border-b border-white/10 bg-[#12151d]/80 px-3 text-xs shadow-lg shadow-black/10 backdrop-blur-2xl sm:px-5">
			<div className="flex min-w-0 items-center gap-3 sm:gap-5">
				<div ref={menuRef} className="relative">
					<button
						type="button"
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen((value) => !value)}
						className="flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold tracking-tight text-white hover:bg-white/10"
					>
						<span className="text-cyan-200">◈</span>
						<span className="hidden sm:inline">DeScience OS</span>
						<ChevronDown className="size-3 text-white/45" />
					</button>
					{menuOpen && (
						<div
							role="menu"
							className="absolute left-0 top-10 z-[900] max-h-[calc(100dvh-60px)] w-72 overflow-y-auto rounded-xl border border-white/15 bg-[#1a1d27]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
						>
							<p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
								DeScience Open Source Club
							</p>
							<div className="mb-1 rounded-lg border border-white/[0.08] bg-white/[0.035] p-2">
								{!authReady ? (
									<p
										className="px-2 py-1.5 text-xs text-white/45"
										role="status"
									>
										Checking member access…
									</p>
								) : memberEmail ? (
									<>
										<p className="truncate px-2 py-1 text-[10px] text-white/45">
											Signed in as
										</p>
										<p className="truncate px-2 pb-2 text-xs text-white/80">
											{memberEmail}
										</p>
										{isAdmin && (
											<a
												href="/admin"
												role="menuitem"
												onClick={() => setMenuOpen(false)}
												className="mb-1 flex items-center gap-2 rounded-lg bg-cyan-100/10 px-2 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-100/15"
											>
												<Settings2 className="size-3.5" />
												Admin area
											</a>
										)}
										<button
											type="button"
											role="menuitem"
											onClick={() => void signOut()}
											className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/75 transition hover:bg-white/10 hover:text-white"
										>
											<LogOut className="size-3.5" />
											Sign out
										</button>
										{signOutError && (
											<p
												className="px-2 pt-1 text-[10px] text-rose-300"
												role="alert"
											>
												{signOutError}
											</p>
										)}
									</>
								) : (
									<a
										href="/login"
										role="menuitem"
										onClick={() => setMenuOpen(false)}
										className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/75 transition hover:bg-white/10 hover:text-white"
									>
										<LogIn className="size-3.5" />
										Member / admin sign in
									</a>
								)}
							</div>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									onOpenHelp();
								}}
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-white/75 hover:bg-white/8"
							>
								<BookOpen className="size-3.5" />
								How to use Hack OS
							</button>
							<a
								role="menuitem"
								href={CLUB_URL}
								target="_blank"
								rel="noopener noreferrer"
								onClick={() => setMenuOpen(false)}
								className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-white/75 hover:bg-white/8"
							>
								<Globe2 className="size-3.5" />
								About DeScience Club
								<ExternalLink className="ml-auto size-3 opacity-35" />
							</a>
							<a
								role="menuitem"
								href={GITHUB_SEARCH_URL}
								target="_blank"
								rel="noopener noreferrer"
								onClick={() => setMenuOpen(false)}
								className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-white/75 hover:bg-white/8"
							>
								<ExternalLink className="size-3.5" />
								GitHub Repo Search
								<ExternalLink className="ml-auto size-3 opacity-35" />
							</a>
							<div className="my-1 border-t border-white/10" />
							<p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
								OS Settings
							</p>
							<div className="px-3 pb-3">
								<p className="mb-2 flex items-center gap-2 text-xs font-medium text-white/75">
									<Palette className="size-3.5" /> Desktop theme
								</p>
								<fieldset
									className="grid grid-cols-2 gap-1.5"
									aria-label="Desktop theme"
								>
									{(["midnight", "aurora", "ember", "light"] as const).map(
										(item) => (
											<button
												key={item}
												type="button"
												aria-pressed={theme === item}
												onClick={() => onThemeChange(item)}
												className={`flex items-center justify-between rounded-lg border px-2 py-2 text-[10px] capitalize transition ${theme === item ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/55 hover:bg-white/5"}`}
											>
												{item}
												{theme === item && <Check className="size-3" />}
											</button>
										),
									)}
								</fieldset>
							</div>
							<div className="px-3 pb-3">
								<p className="mb-2 flex items-center gap-2 text-xs font-medium text-white/75">
									<Type className="size-3.5" /> Text size
								</p>
								<fieldset
									className="grid grid-cols-3 gap-1.5"
									aria-label="Text size"
								>
									{(["standard", "large", "largest"] as const).map(
										(item, index) => (
											<button
												key={item}
												type="button"
												aria-pressed={fontSize === item}
												onClick={() => onFontSizeChange(item)}
												className={`rounded-lg border px-2 py-2 text-xs transition ${fontSize === item ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/55 hover:bg-white/5"}`}
											>
												<span className="font-semibold">
													{["A", "A+", "A++"][index]}
												</span>
												<span className="ml-1 text-[9px] text-white/45">
													{["100%", "112%", "125%"][index]}
												</span>
											</button>
										),
									)}
								</fieldset>
							</div>
							<div className="px-3 pb-2">
								<p className="mb-2 flex items-center gap-2 text-xs font-medium text-white/75">
									<Type className="size-3.5" /> Font family
								</p>
								<fieldset
									className="grid grid-cols-2 gap-1.5"
									aria-label="Font family"
								>
									{(["system", "arial"] as const).map((item) => (
										<button
											key={item}
											type="button"
											aria-pressed={fontFamily === item}
											onClick={() => onFontFamilyChange(item)}
											className={`rounded-lg border px-2 py-2 text-xs capitalize transition ${fontFamily === item ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/55 hover:bg-white/5"}`}
										>
											{item === "system" ? "System UI" : "Arial"}
										</button>
									))}
								</fieldset>
							</div>
							<button
								type="button"
								role="menuitem"
								onClick={() =>
									onClockModeChange(clockMode === "12h" ? "24h" : "12h")
								}
								className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-white/75 hover:bg-white/8"
							>
								<span className="flex items-center gap-2">
									<Settings2 className="size-3.5" />
									Clock format
								</span>
								<span className="text-[10px] text-cyan-100">{clockMode}</span>
							</button>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									window.location.reload();
								}}
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-white/75 hover:bg-white/8"
							>
								<RefreshCw className="size-3.5" />
								Reload System
							</button>
						</div>
					)}
				</div>
				<span className="h-4 w-px bg-white/10" />
				<span className="max-w-36 truncate font-medium text-white/80 sm:max-w-56">
					{activeTitle}
				</span>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
				<span
					className="hidden items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] text-white/55 md:flex"
					title="Browser animation frame rate"
				>
					<Activity className="size-3 text-cyan-200/70" />
					{fps === null ? "—" : fps} FPS
				</span>
				<span
					role="status"
					className="hidden items-center gap-1.5 text-[10px] text-white/55 sm:flex"
					title={
						online
							? "Network connected: this reflects the browser connection only, not Hack OS or AI service health."
							: "Network offline: this reflects the browser connection only, not Hack OS or AI service health."
					}
					aria-label={`Network ${online ? "connected" : "offline"}; AI service status is not checked here`}
				>
					{online ? (
						<Wifi className="size-3 text-emerald-300" />
					) : (
						<WifiOff className="size-3 text-rose-300" />
					)}
					{online ? "Network" : "Offline"}
				</span>
				<span
					role="timer"
					className="min-w-[74px] text-right font-mono tabular-nums text-white/75"
					aria-label="System time"
				>
					{clock}
				</span>
				<button
					type="button"
					onClick={onOpenTerminal}
					aria-label="Open Terminal"
					title="Open Terminal"
					className="grid size-7 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
				>
					<Terminal className="size-3.5" />
				</button>
				<button
					type="button"
					onClick={onOpenPalette}
					aria-label="Open Command Palette"
					title="Command Palette (⌘K)"
					className="grid size-7 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
				>
					<Command className="size-3.5" />
				</button>
			</div>
		</header>
	);
}
