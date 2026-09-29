"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hackathon, HackathonFormat } from "@/types/hackathon";

export type DirectoryStatus = "all" | "open-now" | "upcoming" | "ending-soon";
export type PrizeThreshold = "any" | "1000" | "5000" | "25000";
export type HackathonSort = "deadline" | "prize" | "start" | "recent";
export interface HackathonFilters {
	query: string;
	format: HackathonFormat | "all";
	status: DirectoryStatus;
	tags: string[];
	prize: PrizeThreshold;
	sort: HackathonSort;
}

export const PRIMARY_TAGS = [
	{ slug: "ai-ml", label: "AI/ML" },
	{ slug: "web3", label: "Web3" },
	{ slug: "open-source", label: "Open Source" },
	{ slug: "iot", label: "IoT" },
	{ slug: "cybersecurity", label: "Cybersecurity" },
	{ slug: "mobile", label: "Mobile" },
	{ slug: "fintech", label: "Fintech" },
	{ slug: "beginner-friendly", label: "Beginner Friendly" },
] as const;

const DEFAULT_FILTERS: HackathonFilters = {
	query: "",
	format: "all",
	status: "all",
	tags: [],
	prize: "any",
	sort: "deadline",
};
const ENDING_SOON_MS = 48 * 60 * 60 * 1000;
function isFormat(value: string): value is HackathonFilters["format"] {
	return (
		value === "all" ||
		value === "online" ||
		value === "in-person" ||
		value === "hybrid"
	);
}
function isStatus(value: string): value is DirectoryStatus {
	return (
		value === "all" ||
		value === "open-now" ||
		value === "upcoming" ||
		value === "ending-soon"
	);
}
function isPrize(value: string): value is PrizeThreshold {
	return (
		value === "any" || value === "1000" || value === "5000" || value === "25000"
	);
}
function isSort(value: string): value is HackathonSort {
	return (
		value === "deadline" ||
		value === "prize" ||
		value === "start" ||
		value === "recent"
	);
}

function getInitialFilters(): HackathonFilters {
	if (typeof window === "undefined") return DEFAULT_FILTERS;
	const params = new URLSearchParams(window.location.search);
	const rawFormat = params.get("mode") ?? "all";
	const rawStatus = params.get("status") ?? "all";
	const rawPrize = params.get("prize") ?? "any";
	const rawSort = params.get("sort") ?? "deadline";
	const acceptedTagSlugs = new Set<string>(PRIMARY_TAGS.map((tag) => tag.slug));
	const requestedTags = params.getAll("tag").map((value) => {
		const normalized = value
			.trim()
			.toLocaleLowerCase()
			.replaceAll("/", "-")
			.replaceAll(" ", "-");
		if (normalized === "ai") return "ai-ml";
		return (
			PRIMARY_TAGS.find(
				(tag) =>
					tag.slug === normalized ||
					tag.label.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
			)?.slug ?? normalized
		);
	});
	return {
		query: (params.get("q") ?? "").slice(0, 120),
		format: isFormat(rawFormat) ? rawFormat : "all",
		status: isStatus(rawStatus) ? rawStatus : "all",
		tags: requestedTags.filter((tag) => acceptedTagSlugs.has(tag)),
		prize: isPrize(rawPrize) ? rawPrize : "any",
		sort: isSort(rawSort) ? rawSort : "deadline",
	};
}

function writeFiltersToUrl(filters: HackathonFilters): void {
	const params = new URLSearchParams();
	if (filters.query.trim()) params.set("q", filters.query.trim());
	if (filters.format !== "all") params.set("mode", filters.format);
	if (filters.status !== "all") params.set("status", filters.status);
	for (const tag of filters.tags) params.append("tag", tag);
	if (filters.prize !== "any") params.set("prize", filters.prize);
	if (filters.sort !== "deadline") params.set("sort", filters.sort);
	const query = params.toString();
	const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
	window.history.replaceState(null, "", nextUrl);
}

function deadlineValue(event: Hackathon): number {
	return event.registrationDeadline
		? Date.parse(event.registrationDeadline)
		: Number.POSITIVE_INFINITY;
}

/** Faceted client filter. All expensive text normalization is memoized by input and filters. */
export function useHackathonFilter(events: readonly Hackathon[]) {
	const [filters, setFilters] = useState<HackathonFilters>(DEFAULT_FILTERS);
	const [initialized, setInitialized] = useState(false);
	const [now, setNow] = useState(0);

	useEffect(() => {
		setFilters(getInitialFilters());
		setNow(Date.now());
		setInitialized(true);
	}, []);

	useEffect(() => {
		if (!initialized) return;
		writeFiltersToUrl(filters);
	}, [filters, initialized]);

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);

	const update = useCallback(
		<K extends keyof HackathonFilters>(key: K, value: HackathonFilters[K]) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const toggleTag = useCallback((slug: string) => {
		setFilters((current) => ({
			...current,
			tags: current.tags.includes(slug)
				? current.tags.filter((tag) => tag !== slug)
				: [...current.tags, slug],
		}));
	}, []);

	const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

	const filteredEvents = useMemo(() => {
		const needle = filters.query.trim().toLocaleLowerCase();
		const minimumPrize = filters.prize === "any" ? 0 : Number(filters.prize);
		return events
			.map((event, originalIndex) => ({ event, originalIndex }))
			.filter(({ event }) => {
				const searchable = [
					event.title,
					event.organizer,
					event.description,
					event.venueCity ?? "",
					event.venueCountry ?? "",
					...event.tags.map((tag) => tag.name),
				]
					.join(" ")
					.toLocaleLowerCase();
				const matchesQuery = !needle || searchable.includes(needle);
				const matchesFormat =
					filters.format === "all" || event.format === filters.format;
				const deadline = deadlineValue(event);
				const matchesStatus =
					filters.status === "all" ||
					(filters.status === "open-now" &&
						event.applicationStatus === "open" &&
						(deadline === Number.POSITIVE_INFINITY || deadline > now)) ||
					(filters.status === "upcoming" &&
						event.applicationStatus === "upcoming") ||
					(filters.status === "ending-soon" &&
						event.applicationStatus === "open" &&
						deadline > now &&
						deadline - now <= ENDING_SOON_MS);
				const eventTags = new Set(event.tags.map((tag) => tag.slug));
				const matchesTags =
					filters.tags.length === 0 ||
					filters.tags.some((tag) => eventTags.has(tag));
				const matchesPrize =
					filters.prize === "any" || event.totalPrizeValue > minimumPrize;
				return (
					matchesQuery &&
					matchesFormat &&
					matchesStatus &&
					matchesTags &&
					matchesPrize
				);
			})
			.sort((a, b) => {
				if (filters.sort === "prize")
					return b.event.totalPrizeValue - a.event.totalPrizeValue;
				if (filters.sort === "start")
					return Date.parse(a.event.startDate) - Date.parse(b.event.startDate);
				if (filters.sort === "recent")
					return Date.parse(b.event.createdAt) - Date.parse(a.event.createdAt);
				return deadlineValue(a.event) - deadlineValue(b.event);
			})
			.map(({ event }) => event);
	}, [events, filters, now]);

	return { filters, filteredEvents, update, toggleTag, reset, now } as const;
}
