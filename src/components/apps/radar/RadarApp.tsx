"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	CalendarDays,
	ChevronDown,
	ListFilter,
	Map as MapIcon,
	PanelsTopLeft,
	Search,
	SlidersHorizontal,
	Sparkles,
	X,
} from "lucide-react";
import { HackathonCard } from "@/components/apps/radar/HackathonCard";
import { HackathonDetailDrawer } from "@/components/apps/radar/HackathonDetailDrawer";
import {
	useHackathonFilter,
	PRIMARY_TAGS,
	type HackathonSort,
	type PrizeThreshold,
} from "@/hooks/useHackathonFilter";
import { usePublishedHackathons } from "@/hooks/usePublishedHackathons";
import { useWindowManager } from "@/stores/useWindowManager";
import type { Hackathon } from "@/types/hackathon";

type ViewMode = "grid" | "list" | "timeline";
const SORT_OPTIONS: readonly { value: HackathonSort; label: string }[] = [
	{ value: "deadline", label: "Deadline: soonest" },
	{ value: "prize", label: "Prize: highest" },
	{ value: "start", label: "Start date: nearest" },
	{ value: "recent", label: "Recently added" },
];
const PRIZE_OPTIONS: readonly { value: PrizeThreshold; label: string }[] = [
	{ value: "any", label: "Any prize" },
	{ value: "1000", label: ">$1,000" },
	{ value: "5000", label: ">$5,000" },
	{ value: "25000", label: ">$25,000" },
];
const selectClass =
	"h-9 rounded-lg border border-white/10 bg-[#171a23] px-2.5 text-[10px] text-white/75 outline-none focus:border-cyan-200/40";

/** Radar app is the discovery shell; URL filters stay shareable across sessions. */
export function RadarApp() {
	const { events, loading, error, refresh } = usePublishedHackathons();
	const { filters, filteredEvents, update, toggleTag, reset } =
		useHackathonFilter(events);
	const [view, setView] = useState<ViewMode>("grid");
	const [filtersOpen, setFiltersOpen] = useState(true);
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<Hackathon | null>(null);
	const [visibleCount, setVisibleCount] = useState(8);
	const radarQuery = useWindowManager((state) => state.radarQuery);
	const setRadarQuery = useWindowManager((state) => state.setRadarQuery);
	const savedIds = useWindowManager((state) => state.savedHackathonIds);
	const toggleSaved = useWindowManager((state) => state.toggleSavedHackathon);
	const openWindow = useWindowManager((state) => state.openWindow);
	const setCopilotContext = useWindowManager(
		(state) => state.setPendingCopilotHackathon,
	);

	useEffect(() => {
		if (radarQuery && radarQuery !== filters.query) update("query", radarQuery);
	}, [filters.query, radarQuery, update]);

	useEffect(() => {
		setVisibleCount(filteredEvents.length > 8 ? 8 : filteredEvents.length || 8);
	}, [filteredEvents.length]);

	const visibleEvents = useMemo(
		() => filteredEvents.slice(0, visibleCount),
		[filteredEvents, visibleCount],
	);

	function updateQuery(query: string) {
		update("query", query);
		setRadarQuery(query);
	}

	function clearFilters() {
		reset();
		setRadarQuery("");
	}

	function startIdeation(event: Hackathon) {
		setCopilotContext(event);
		setSelectedEvent(null);
		openWindow("copilot");
	}

	function toggleFormat() {
		update("format", filters.format === "online" ? "all" : "online");
	}

	return (
		<section className="relative flex h-full min-h-[420px] overflow-hidden bg-[#11141c] text-white">
			<AnimatePresence initial={false}>
				{filtersOpen && (
					<motion.aside
						initial={{ width: 0, opacity: 0 }}
						animate={{ width: 228, opacity: 1 }}
						exit={{ width: 0, opacity: 0 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className="hidden h-full shrink-0 overflow-hidden border-r border-white/[0.08] bg-black/10 md:block"
					>
						<div className="h-full w-[228px] overflow-y-auto p-4">
							<div className="flex items-center justify-between">
								<h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
									Refine results
								</h2>
								<button
									type="button"
									onClick={clearFilters}
									className="text-[9px] text-cyan-100/65 hover:text-cyan-50"
								>
									Reset
								</button>
							</div>
							<fieldset className="mt-5">
								<legend className="mb-2 text-[10px] font-medium text-white/45">
									Event format
								</legend>
								<div className="space-y-1">
									{[
										{ value: "all", label: "All formats" },
										{ value: "online", label: "Online" },
										{ value: "in-person", label: "In person" },
										{ value: "hybrid", label: "Hybrid" },
									].map((item) => (
										<label
											key={item.value}
											className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-white/65 hover:bg-white/[0.04]"
										>
											<input
												type="radio"
												name="radar-format"
												checked={filters.format === item.value}
												onChange={() =>
													update(
														"format",
														item.value === "all" ||
															item.value === "online" ||
															item.value === "in-person" ||
															item.value === "hybrid"
															? item.value
															: "all",
													)
												}
												className="accent-cyan-200"
											/>
											{item.label}
										</label>
									))}
								</div>
							</fieldset>
							<fieldset className="mt-5">
								<legend className="mb-2 text-[10px] font-medium text-white/45">
									Registration
								</legend>
								<select
									value={filters.status}
									onChange={(event) => {
										const status = event.target.value;
										if (
											status === "all" ||
											status === "open-now" ||
											status === "upcoming" ||
											status === "ending-soon"
										)
											update("status", status);
									}}
									className={`${selectClass} w-full`}
								>
									<option value="all">Any status</option>
									<option value="open-now">Open now</option>
									<option value="upcoming">Upcoming</option>
									<option value="ending-soon">Ending soon · 48h</option>
								</select>
							</fieldset>
							<fieldset className="mt-5">
								<legend className="mb-2 text-[10px] font-medium text-white/45">
									Prize pool minimum
								</legend>
								<select
									value={filters.prize}
									onChange={(event) => {
										const prize = event.target.value;
										if (
											prize === "any" ||
											prize === "1000" ||
											prize === "5000" ||
											prize === "25000"
										)
											update("prize", prize);
									}}
									className={`${selectClass} w-full`}
								>
									{PRIZE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</fieldset>
							<fieldset className="mt-5">
								<legend className="mb-2 text-[10px] font-medium text-white/45">
									Tech & interests
								</legend>
								<div className="flex flex-wrap gap-1.5">
									{PRIMARY_TAGS.map((tag) => (
										<button
											key={tag.slug}
											type="button"
											aria-pressed={filters.tags.includes(tag.slug)}
											onClick={() => toggleTag(tag.slug)}
											className={`rounded-md border px-2 py-1.5 text-[9px] transition ${filters.tags.includes(tag.slug) ? "border-cyan-100/35 bg-cyan-100/10 text-cyan-50" : "border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/75"}`}
										>
											{tag.label}
										</button>
									))}
								</div>
							</fieldset>
							<p className="mt-5 text-[9px] leading-4 text-white/30">
								Only reviewed, published events appear here. Confirm deadlines
								on the official event page before applying.
							</p>
						</div>
					</motion.aside>
				)}
			</AnimatePresence>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="shrink-0 border-b border-white/[0.08] px-4 pb-3 pt-4 sm:px-5">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div className="flex items-center gap-2">
								<span className="grid size-7 place-items-center rounded-lg border border-cyan-100/15 bg-cyan-100/[0.07] text-cyan-100">
									<Sparkles className="size-3.5" />
								</span>
								<p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
									DESCIENCE RADAR
								</p>
							</div>
							<h1 className="mt-2 text-lg font-semibold tracking-tight">
								Find your next build.
							</h1>
							<p className="mt-1 text-[10px] text-white/40">
								Discover events, meet your people, make something matter.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => {
									setFiltersOpen((open) => !open);
									setMobileFiltersOpen((open) => !open);
								}}
								aria-pressed={filtersOpen || mobileFiltersOpen}
								className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[10px] text-white/60 hover:border-white/20"
							>
								<SlidersHorizontal className="size-3.5" />
								Filters
							</button>
							<button
								type="button"
								onClick={toggleFormat}
								className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] ${filters.format === "online" ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/60 hover:border-white/20"}`}
							>
								<MapIcon className="size-3.5" />
								{filters.format === "online" ? "Online only" : "Quick: online"}
							</button>
							<fieldset className="flex rounded-lg border border-white/10 p-0.5">
								<legend className="sr-only">Directory view mode</legend>
								{(
									[
										["grid", PanelsTopLeft],
										["list", ListFilter],
										["timeline", CalendarDays],
									] as const
								).map(([mode, Icon]) => (
									<button
										key={mode}
										type="button"
										onClick={() => setView(mode)}
										aria-label={`${mode} view`}
										aria-pressed={view === mode}
										className={`grid size-7 place-items-center rounded-md transition ${view === mode ? "bg-white/10 text-white" : "text-white/35 hover:text-white/70"}`}
									>
										<Icon className="size-3.5" />
									</button>
								))}
							</fieldset>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						<div className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-3 focus-within:border-cyan-100/35">
							<Search className="size-3.5 shrink-0 text-cyan-100/60" />
							<input
								value={filters.query}
								onChange={(event) => updateQuery(event.target.value)}
								placeholder="Search events, topics, cities…"
								aria-label="Search hackathons"
								className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-white/25"
							/>
							{filters.query && (
								<button
									type="button"
									onClick={() => updateQuery("")}
									aria-label="Clear search"
									className="text-white/45 hover:text-white"
								>
									<X className="size-3.5" />
								</button>
							)}
						</div>
						<label className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-2.5 text-[9px] text-white/40">
							Sort
							<ChevronDown className="-mr-1 size-3 text-white/25" />
							<select
								aria-label="Sort hackathons"
								value={filters.sort}
								onChange={(event) => {
									const option = SORT_OPTIONS.find(
										(candidate) => candidate.value === event.target.value,
									);
									if (option) update("sort", option.value);
								}}
								className="max-w-[150px] bg-transparent text-[10px] text-white/75 outline-none"
							>
								{SORT_OPTIONS.map((option) => (
									<option
										key={option.value}
										value={option.value}
										className="bg-[#171a23]"
									>
										{option.label}
									</option>
								))}
							</select>
						</label>
					</div>
				</header>

				<div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
					<p className="text-[10px] text-white/50">
						<strong className="font-semibold text-white">
							{filteredEvents.length}
						</strong>{" "}
						verified opportunities
					</p>
					<p className="hidden items-center gap-1.5 text-[9px] text-white/30 sm:flex">
						<CalendarDays className="size-3" />
						Approved by DeScience · confirm details before applying
					</p>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
					{loading ? (
						<p className="mx-auto mt-10 max-w-sm text-center text-xs text-white/50">
							Loading verified events…
						</p>
					) : error ? (
						<div className="mx-auto mt-10 max-w-sm rounded-xl border border-rose-200/20 p-6 text-center text-xs text-rose-100">
							<p>{error}</p>
							<button
								type="button"
								onClick={() => void refresh()}
								className="mt-3 rounded-lg border border-white/20 px-3 py-2"
							>
								Retry
							</button>
						</div>
					) : visibleEvents.length > 0 ? (
						view === "timeline" ? (
							<div className="mx-auto max-w-3xl space-y-3">
								{visibleEvents.map((event) => (
									<div
										key={event.id}
										className="relative pl-5 before:absolute before:bottom-0 before:left-[5px] before:top-0 before:w-px before:bg-cyan-100/15"
									>
										<span className="absolute left-0 top-5 size-[11px] rounded-full border-2 border-cyan-100/80 bg-[#11141c]" />
										<p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-cyan-100/60">
											{new Intl.DateTimeFormat("en", {
												dateStyle: "medium",
												timeZone: "UTC",
											}).format(new Date(event.startDate))}
										</p>
										<HackathonCard
											event={event}
											compact
											saved={savedIds.includes(event.id)}
											onBookmark={(item) => toggleSaved(item.id)}
											onInspect={setSelectedEvent}
										/>
									</div>
								))}
							</div>
						) : (
							<div
								className={
									view === "grid"
										? "grid gap-3 xl:grid-cols-2"
										: "mx-auto flex max-w-4xl flex-col gap-3"
								}
							>
								{visibleEvents.map((event) => (
									<HackathonCard
										key={event.id}
										event={event}
										compact={view === "list"}
										saved={savedIds.includes(event.id)}
										onBookmark={(item) => toggleSaved(item.id)}
										onInspect={setSelectedEvent}
									/>
								))}
							</div>
						)
					) : (
						<div className="mx-auto mt-10 max-w-sm rounded-xl border border-dashed border-white/10 p-8 text-center">
							<Search className="mx-auto size-5 text-white/25" />
							<h2 className="mt-3 text-sm font-medium text-white/75">
								{events.length === 0
									? "No approved events are live yet"
									: "No events match these filters"}
							</h2>
							<p className="mt-1 text-[10px] leading-5 text-white/35">
								{events.length === 0
									? "Club admins review official event details before they appear here."
									: "Try a wider search or reset the filters."}
							</p>
							{events.length > 0 && (
								<button
									type="button"
									onClick={clearFilters}
									className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-white/65 hover:border-cyan-100/30"
								>
									Clear all filters
								</button>
							)}
						</div>
					)}
					{filteredEvents.length > visibleCount && (
						<button
							type="button"
							onClick={() => setVisibleCount((count) => count + 8)}
							className="mx-auto mt-4 flex h-9 items-center rounded-lg border border-white/10 px-4 text-[10px] text-white/60 transition hover:border-cyan-100/25 hover:text-white"
						>
							Load more events
						</button>
					)}
				</div>
			</div>

			<AnimatePresence>
				{mobileFiltersOpen && (
					<motion.div
						className="absolute inset-0 z-40 bg-black/55 md:hidden"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={(event) => {
							if (event.target === event.currentTarget)
								setMobileFiltersOpen(false);
						}}
					>
						<motion.aside
							role="dialog"
							aria-label="Hackathon filters"
							className="absolute bottom-0 left-0 right-0 max-h-[78%] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#171a23] p-5 shadow-2xl"
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", stiffness: 300, damping: 28 }}
						>
							<div className="flex items-center justify-between">
								<h2 className="text-xs font-semibold text-white">
									Refine results
								</h2>
								<button
									type="button"
									onClick={() => setMobileFiltersOpen(false)}
									aria-label="Close filters"
									className="text-white/50 hover:text-white"
								>
									<X className="size-4" />
								</button>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								{[
									{ value: "all", label: "All formats" },
									{ value: "online", label: "Online" },
									{ value: "in-person", label: "In person" },
									{ value: "hybrid", label: "Hybrid" },
								].map((item) => (
									<button
										key={item.value}
										type="button"
										onClick={() => {
											if (
												item.value === "all" ||
												item.value === "online" ||
												item.value === "in-person" ||
												item.value === "hybrid"
											)
												update("format", item.value);
										}}
										aria-pressed={filters.format === item.value}
										className={`rounded-lg border px-3 py-2 text-[10px] ${filters.format === item.value ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/60"}`}
									>
										{item.label}
									</button>
								))}
							</div>
							<div className="mt-5 flex flex-wrap gap-2">
								{PRIMARY_TAGS.map((tag) => (
									<button
										key={tag.slug}
										type="button"
										onClick={() => toggleTag(tag.slug)}
										aria-pressed={filters.tags.includes(tag.slug)}
										className={`rounded-md border px-2.5 py-2 text-[10px] ${filters.tags.includes(tag.slug) ? "border-cyan-100/35 bg-cyan-100/10 text-cyan-50" : "border-white/10 text-white/55"}`}
									>
										{tag.label}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={() => {
									clearFilters();
									setMobileFiltersOpen(false);
								}}
								className="mt-5 w-full rounded-lg border border-white/10 py-2 text-[10px] text-white/65"
							>
								Reset filters
							</button>
						</motion.aside>
					</motion.div>
				)}
			</AnimatePresence>

			<HackathonDetailDrawer
				event={selectedEvent}
				onClose={() => setSelectedEvent(null)}
				onIdeate={startIdeation}
			/>
		</section>
	);
}
