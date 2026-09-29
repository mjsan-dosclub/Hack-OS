"use client";

import { useEffect, useRef, useState } from "react";
import {
	Activity,
	BookOpen,
	ChevronDown,
	Command,
	ExternalLink,
	Globe2,
	RefreshCw,
	Settings2,
	Terminal,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useWindowManager } from "@/stores/useWindowManager";

export type ClockMode = "12h" | "24h";

interface MenuBarProps {
	clockMode: ClockMode;
	onClockModeChange: (mode: ClockMode) => void;
	onOpenTerminal: () => void;
	onOpenHelp: () => void;
	onOpenPalette: () => void;
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
}: MenuBarProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [clock, setClock] = useState("");
	const [online, setOnline] = useState(true);
	const [fps, setFps] = useState<number | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
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
							className="absolute left-0 top-10 z-[900] w-60 rounded-xl border border-white/15 bg-[#1a1d27]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
						>
							<p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
								DeScience Open Source Club
							</p>
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
					className="hidden items-center gap-1.5 text-[10px] text-white/55 sm:flex"
					title={
						online
							? "Browser reports an active network connection"
							: "Browser reports no network connection"
					}
				>
					{online ? (
						<Wifi className="size-3 text-emerald-300" />
					) : (
						<WifiOff className="size-3 text-rose-300" />
					)}
					{online ? "Online" : "Offline"}
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
