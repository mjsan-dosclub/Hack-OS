"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Activity,
	ArrowUpRight,
	BookOpen,
	Bot,
	Command,
	Globe2,
	Map as MapIcon,
	Radar,
	Search,
	Terminal,
	type LucideIcon,
} from "lucide-react";
import { useWindowManager, type AppKey } from "@/stores/useWindowManager";

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
	onOpenApp: (appKey: AppKey) => void;
	onToggleFullscreen: () => void;
	onSwitchWallpaper: () => void;
}

interface PaletteCommand {
	id: string;
	title: string;
	detail: string;
	category: string;
	run: () => void;
	icon: LucideIcon;
}

const CLUB_HOME = "https://descienceosclub.com/";
const MEMBERSHIP = "https://membership.descienceosclub.com/";
const CLUB_LINKEDIN =
	"https://www.linkedin.com/company/descience-open-source-club";
export function CommandPalette({
	open,
	onClose,
	onOpenApp,
	onToggleFullscreen,
	onSwitchWallpaper,
}: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const previousFocus = useRef<HTMLElement | null>(null);
	const setRadarQuery = useWindowManager((state) => state.setRadarQuery);
	const minimizeAllWindows = useWindowManager(
		(state) => state.minimizeAllWindows,
	);

	const commands = useMemo<PaletteCommand[]>(() => {
		const openApplication = (appKey: AppKey) => () => onOpenApp(appKey);
		const runQuickSearch = (term: string) => () => {
			setRadarQuery(term);
			onOpenApp("radar");
		};
		const external = (url: string) => () => {
			window.open(url, "_blank", "noopener,noreferrer");
		};
		return [
			{
				id: "start-here",
				title: "Start Here · How to use Hack OS",
				detail: "Quick tour and a sample hackathon workflow",
				category: "Help",
				run: openApplication("help"),
				icon: BookOpen,
			},
			{
				id: "launch-radar",
				title: "Launch Radar",
				detail: "Open Hackathon Directory",
				category: "Applications",
				run: openApplication("radar"),
				icon: Radar,
			},
			{
				id: "open-terminal",
				title: "Open Terminal",
				detail: "Launch Club CLI",
				category: "Applications",
				run: openApplication("terminal"),
				icon: Terminal,
			},
			{
				id: "open-map",
				title: "Open Hackamaps Explorer",
				detail: "Browse events by place",
				category: "Applications",
				run: openApplication("map"),
				icon: MapIcon,
			},
			{
				id: "ai-ideator",
				title: "AI Ideator",
				detail: "Brainstorm a project concept",
				category: "Applications",
				run: openApplication("copilot"),
				icon: Bot,
			},
			{
				id: "online-hackathons",
				title: "Search Online Hackathons",
				detail: "Open Radar with online events",
				category: "Radar filters",
				run: runQuickSearch("online"),
				icon: Search,
			},
			{
				id: "ai-tracks",
				title: "Search AI Tracks",
				detail: "Open Radar with AI / ML events",
				category: "Radar filters",
				run: runQuickSearch("AI / ML"),
				icon: Search,
			},
			{
				id: "membership",
				title: "Visit Membership Portal",
				detail: "membership.descienceosclub.com",
				category: "DeScience Club",
				run: external(MEMBERSHIP),
				icon: Globe2,
			},
			{
				id: "webinars",
				title: "OpenSource Friday Webinars",
				detail: "Club events and webinars",
				category: "DeScience Club",
				run: external(`${CLUB_HOME}#events`),
				icon: Globe2,
			},
			{
				id: "linkedin",
				title: "Club LinkedIn",
				detail: "DeScience Open Source Club",
				category: "DeScience Club",
				run: external(CLUB_LINKEDIN),
				icon: ArrowUpRight,
			},
			{
				id: "fullscreen",
				title: "Toggle Fullscreen",
				detail: "Enter or leave browser fullscreen",
				category: "System",
				run: onToggleFullscreen,
				icon: Activity,
			},
			{
				id: "minimize-all",
				title: "Minimize All Windows",
				detail: "Send open apps to the dock",
				category: "System",
				run: minimizeAllWindows,
				icon: Command,
			},
			{
				id: "wallpaper",
				title: "Switch Wallpaper",
				detail: "Cycle desktop background",
				category: "System",
				run: onSwitchWallpaper,
				icon: Globe2,
			},
		];
	}, [
		minimizeAllWindows,
		onOpenApp,
		onSwitchWallpaper,
		onToggleFullscreen,
		setRadarQuery,
	]);

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return commands;
		return commands.filter((item) =>
			`${item.title} ${item.detail} ${item.category}`
				.toLowerCase()
				.includes(normalized),
		);
	}, [commands, query]);

	useEffect(() => {
		if (!open) return;
		previousFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setQuery("");
		setSelectedIndex(0);
		requestAnimationFrame(() => inputRef.current?.focus());
		return () => previousFocus.current?.focus();
	}, [open]);

	useEffect(() => {
		setSelectedIndex((index) =>
			Math.min(index, Math.max(0, filtered.length - 1)),
		);
	}, [filtered.length]);
	if (!open) return null;

	function runSelected(index: number) {
		const command = filtered[index];
		if (!command) return;
		command.run();
		onClose();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSelectedIndex((index) =>
				Math.min(index + 1, Math.max(0, filtered.length - 1)),
			);
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setSelectedIndex((index) => Math.max(0, index - 1));
		}
		if (event.key === "Enter") {
			event.preventDefault();
			runSelected(selectedIndex);
		}
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		}
	}

	function trapTab(event: React.KeyboardEvent<HTMLElement>) {
		if (event.key !== "Tab") return;
		const focusable = [
			...event.currentTarget.querySelectorAll<HTMLElement>(
				"input:not([disabled]), button:not([disabled])",
			),
		];
		if (!focusable.length) return;
		const currentIndex = focusable.indexOf(
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: (inputRef.current ?? focusable[0]),
		);
		const nextIndex = event.shiftKey
			? currentIndex <= 0
				? focusable.length - 1
				: currentIndex - 1
			: currentIndex < 0 || currentIndex === focusable.length - 1
				? 0
				: currentIndex + 1;
		event.preventDefault();
		focusable[nextIndex]?.focus();
	}

	let lastCategory = "";
	return (
		<div
			className="fixed inset-0 z-[1000] flex items-start justify-center bg-[#06080d]/55 px-4 pt-[12vh] backdrop-blur-md"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Command Palette"
				onKeyDown={trapTab}
				className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#171a23]/95 shadow-[0_25px_100px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
			>
				<div className="flex items-center gap-3 border-b border-white/10 px-4">
					<Search className="size-4 text-cyan-200" />
					<input
						ref={inputRef}
						role="combobox"
						aria-expanded="true"
						aria-controls="command-options"
						aria-activedescendant={
							filtered[selectedIndex]
								? `command-${filtered[selectedIndex].id}`
								: undefined
						}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search apps, actions, and club links…"
						className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
					/>
					<kbd className="rounded border border-white/10 px-1.5 py-1 text-[10px] text-white/40">
						ESC
					</kbd>
				</div>
				<div
					id="command-options"
					role="listbox"
					aria-label="Commands"
					className="max-h-[58vh] overflow-auto p-2"
				>
					{filtered.map((command, index) => {
						const showCategory = command.category !== lastCategory;
						lastCategory = command.category;
						const Icon = command.icon;
						return (
							<div key={command.id}>
								{showCategory && (
									<p className="px-2 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
										{command.category}
									</p>
								)}
								<button
									type="button"
									id={`command-${command.id}`}
									role="option"
									aria-selected={selectedIndex === index}
									onPointerEnter={() => setSelectedIndex(index)}
									onClick={() => runSelected(index)}
									className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${selectedIndex === index ? "bg-cyan-200/10 text-white" : "text-white/65 hover:bg-white/[0.04]"}`}
								>
									<Icon className="size-4 shrink-0 text-cyan-100/75" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-xs font-medium">
											{command.title}
										</span>
										<span className="mt-0.5 block truncate text-[10px] text-white/40">
											{command.detail}
										</span>
									</span>
									<ArrowUpRight className="size-3.5 shrink-0 opacity-30" />
								</button>
							</div>
						);
					})}
					{!filtered.length && (
						<p className="px-3 py-8 text-center text-xs text-white/40">
							No matching commands.
						</p>
					)}
				</div>
				<footer className="flex justify-between border-t border-white/10 px-4 py-2 text-[9px] text-white/35">
					<span>Navigate ↑ ↓ · Run ↵ · Close Esc</span>
					<span>DeScience OS</span>
				</footer>
			</section>
		</div>
	);
}
