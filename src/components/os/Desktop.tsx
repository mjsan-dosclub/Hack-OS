"use client";

import { AnimatePresence, LayoutGroup } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopilotApp } from "@/components/apps/copilot/CopilotApp";
import { HackamapsApp } from "@/components/apps/map/HackamapsApp";
import { RadarApp } from "@/components/apps/radar/RadarApp";
import { StartHereApp } from "@/components/apps/StartHereApp";
import { SynergyProfilerApp } from "@/components/apps/synergy/SynergyProfilerApp";
import { TerminalApp } from "@/components/apps/TerminalApp";
import { CommandPalette } from "@/components/os/CommandPalette";
import { DesktopDashboard } from "@/components/os/DesktopDashboard";
import { Dock } from "@/components/os/Dock";
import { type ClockMode, MenuBar } from "@/components/os/MenuBar";
import { WindowFrame } from "@/components/os/WindowFrame";
import { useDesktopAppearance } from "@/hooks/useDesktopAppearance";
import {
	type AppKey,
	selectVisibleWindows,
	useWindowManager,
} from "@/stores/useWindowManager";

function AppContent({ appKey }: { appKey: AppKey }) {
	switch (appKey) {
		case "radar":
			return <RadarApp />;
		case "terminal":
			return <TerminalApp />;
		case "map":
			return <HackamapsApp />;
		case "copilot":
			return <CopilotApp />;
		case "help":
			return <StartHereApp />;
		case "synergy":
			return <SynergyProfilerApp />;
	}
	return null;
}

export function Desktop({ initialApp }: { initialApp?: AppKey } = {}) {
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [clockMode, setClockMode] = useState<ClockMode>("24h");
	const appearance = useDesktopAppearance();
	const [welcomeOpen, setWelcomeOpen] = useState(false);
	const desktopBoundsRef = useRef<HTMLDivElement>(null);
	const windows = useWindowManager((state) => state.windows);
	const activeWindowId = useWindowManager((state) => state.activeWindowId);
	const openWindow = useWindowManager((state) => state.openWindow);
	const closeWindow = useWindowManager((state) => state.closeWindow);
	const minimizeWindow = useWindowManager((state) => state.minimizeWindow);
	const bringToFront = useWindowManager((state) => state.bringToFront);
	const unfocusAll = useWindowManager((state) => state.unfocusAll);
	const updatePosition = useWindowManager((state) => state.updatePosition);
	const updateSize = useWindowManager((state) => state.updateSize);

	useEffect(() => {
		if (initialApp) {
			openWindow(initialApp);
			return;
		}
		try {
			if (
				window.localStorage.getItem("hack-os:welcome-dismissed:v1") !== "true"
			) {
				setWelcomeOpen(true);
			}
		} catch {
			setWelcomeOpen(true);
		}
	}, [initialApp, openWindow]);

	function dismissWelcome(openGuide: boolean): void {
		setWelcomeOpen(false);
		try {
			window.localStorage.setItem("hack-os:welcome-dismissed:v1", "true");
		} catch {
			// Continue normally when browser storage is unavailable.
		}
		if (openGuide) openWindow("help");
	}

	async function toggleFullscreen() {
		if (document.fullscreenElement) {
			await document.exitFullscreen().catch(() => undefined);
			return;
		}
		await document.documentElement.requestFullscreen().catch(() => undefined);
	}

	useEffect(() => {
		function handleShortcut(event: KeyboardEvent) {
			const modifier = event.metaKey || event.ctrlKey;
			if (modifier && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPaletteOpen(true);
				return;
			}
			if (modifier && event.key.toLowerCase() === "w" && activeWindowId) {
				event.preventDefault();
				closeWindow(activeWindowId);
				return;
			}
			if (event.altKey && event.key === "Tab") {
				event.preventDefault();
				const openWindows = [
					...selectVisibleWindows(useWindowManager.getState()),
				].sort((a, b) => a.zIndex - b.zIndex);
				if (openWindows.length < 2) return;
				const currentIndex = openWindows.findIndex(
					(item) => item.id === activeWindowId,
				);
				bringToFront(openWindows[(currentIndex + 1) % openWindows.length].id);
				return;
			}
			if (event.key === "Escape") {
				if (paletteOpen) {
					setPaletteOpen(false);
					return;
				}
				const target = event.target;
				const isEditing =
					target instanceof HTMLElement &&
					(target.isContentEditable ||
						["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
				if (!isEditing && activeWindowId) minimizeWindow(activeWindowId);
			}
		}
		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, [activeWindowId, bringToFront, closeWindow, minimizeWindow, paletteOpen]);

	return (
		<LayoutGroup>
			<main
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) unfocusAll();
				}}
				data-theme={appearance.theme}
				className="desktop-root desktop-grain relative h-dvh min-h-[520px] overflow-hidden bg-[#0e1118] font-sans text-white selection:bg-cyan-200/25"
			>
				<div
					aria-hidden="true"
					className="desktop-wallpaper pointer-events-none absolute inset-0 transition-[background] duration-700"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:40px_40px]"
				/>

				<MenuBar
					clockMode={clockMode}
					onClockModeChange={setClockMode}
					theme={appearance.theme}
					onThemeChange={appearance.setTheme}
					fontSize={appearance.fontSize}
					onFontSizeChange={appearance.setFontSize}
					fontFamily={appearance.fontFamily}
					onFontFamilyChange={appearance.setFontFamily}
					onOpenTerminal={() => openWindow("terminal")}
					onOpenHelp={() => openWindow("help")}
					onOpenPalette={() => setPaletteOpen(true)}
				/>

				<div
					ref={desktopBoundsRef}
					onPointerDown={(event) => {
						if (event.target === event.currentTarget) {
							unfocusAll();
						}
					}}
					className="absolute inset-x-0 bottom-[88px] top-11"
				>
					<DesktopDashboard />
					<AnimatePresence initial={false}>
						{windows
							.filter((item) => item.isOpen && !item.isMinimized)
							.map((item) => (
								<WindowFrame
									key={item.id}
									window={item}
									active={activeWindowId === item.id}
									desktopBoundsRef={desktopBoundsRef}
									onFocus={() => bringToFront(item.id)}
									onClose={() => closeWindow(item.id)}
									onMinimize={() => minimizeWindow(item.id)}
									onMaximize={() =>
										useWindowManager.getState().maximizeWindow(item.id)
									}
									onMove={(position) => updatePosition(item.id, position)}
									onResize={(size) => updateSize(item.id, size)}
								>
									<AppContent appKey={item.componentKey} />
								</WindowFrame>
							))}
					</AnimatePresence>
				</div>

				<Dock onOpenPalette={() => setPaletteOpen(true)} />
				{welcomeOpen && (
					<div className="absolute inset-x-0 bottom-24 top-11 z-[600] grid place-items-center bg-black/20 p-4 backdrop-blur-[2px]">
						<section
							role="dialog"
							aria-modal="true"
							aria-labelledby="welcome-title"
							className="os-welcome-dialog w-full max-w-lg rounded-2xl border border-white/15 bg-[#171b25]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl"
						>
							<div className="grid size-11 place-items-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-100">
								<BookOpen className="size-5" />
							</div>
							<p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
								WELCOME TO HACK OS
							</p>
							<h1
								id="welcome-title"
								className="mt-1 text-xl font-semibold text-white"
							>
								Your student hackathon workspace.
							</h1>
							<p className="mt-2 text-xs leading-5 text-white/60">
								Find hackathons, check deadlines and locations, and use the
								Co-Pilot to turn a team idea into a build plan. Start Here
								explains the apps and includes a prompt you can try.
							</p>
							<div className="mt-5 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => dismissWelcome(true)}
									className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-100 px-3 text-[10px] font-semibold text-[#09151a] transition hover:bg-cyan-50"
								>
									<BookOpen className="size-3.5" />
									Show me around
								</button>
								<button
									type="button"
									onClick={() => dismissWelcome(false)}
									className="h-9 rounded-lg border border-white/10 px-3 text-[10px] text-white/65 transition hover:text-white"
								>
									Skip for now
								</button>
								<p className="basis-full text-[9px] text-white/35">
									Reopen Start Here any time from the dock.
								</p>
							</div>
						</section>
					</div>
				)}
				<CommandPalette
					open={paletteOpen}
					onClose={() => setPaletteOpen(false)}
					onOpenApp={openWindow}
					onToggleFullscreen={() => {
						void toggleFullscreen();
					}}
					onSwitchWallpaper={appearance.cycleTheme}
				/>
			</main>
		</LayoutGroup>
	);
}
