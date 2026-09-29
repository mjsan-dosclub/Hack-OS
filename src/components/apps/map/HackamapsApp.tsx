"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
	AlertCircle,
	Crosshair,
	Globe2,
	MapPin,
	Navigation,
	Search,
} from "lucide-react";
import { HackathonDetailDrawer } from "@/components/apps/radar/HackathonDetailDrawer";
import { MapEventCard } from "@/components/apps/map/MapEventCard";
import { MOCK_HACKATHONS } from "@/lib/mockHackathons";
import { useWindowManager } from "@/stores/useWindowManager";
import type { Hackathon } from "@/types/hackathon";
import type {
	HackathonCluster,
	MapFocus,
} from "@/components/apps/map/MapCanvas";

const MapCanvas = dynamic(
	() =>
		import("@/components/apps/map/MapCanvas").then(
			(module) => module.MapCanvas,
		),
	{
		ssr: false,
		loading: () => (
			<div className="grid h-full min-h-[340px] place-items-center bg-[#131820] text-[11px] text-white/40">
				Loading open map tiles…
			</div>
		),
	},
);

type Region = "india" | "online";
const REGION_LABELS: ReadonlyArray<{ id: Region; label: string }> = [
	{ id: "india", label: "India" },
	{ id: "online", label: "Online" },
];
const DEFAULT_FOCUS: MapFocus = { latitude: 22.5, longitude: 79, zoom: 4.8 };

function distanceKm(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number },
): number {
	const radians = (degrees: number) => (degrees * Math.PI) / 180;
	const latDistance = radians(b.latitude - a.latitude);
	const lonDistance = radians(b.longitude - a.longitude);
	const value =
		Math.sin(latDistance / 2) ** 2 +
		Math.cos(radians(a.latitude)) *
			Math.cos(radians(b.latitude)) *
			Math.sin(lonDistance / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function inRegion(event: Hackathon, region: Region): boolean {
	if (region === "online") return event.format === "online";
	const point = event.coordinates;
	if (event.format === "online") return false;
	const country = event.venueCountry?.trim().toLocaleLowerCase();
	const countryMatches = country === "india" || country === "in";
	const coordinatesMatch =
		point !== null &&
		point.latitude >= 6 &&
		point.latitude <= 38 &&
		point.longitude >= 68 &&
		point.longitude <= 98;
	return countryMatches || coordinatesMatch;
}

function clusterEvents(events: Hackathon[]): HackathonCluster[] {
	const clusters = new Map<string, HackathonCluster>();
	for (const event of events) {
		const point = event.coordinates;
		if (!point) continue;
		const latitude = Math.round(point.latitude * 20) / 20;
		const longitude = Math.round(point.longitude * 20) / 20;
		const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
		const current = clusters.get(key);
		if (current) current.events.push(event);
		else clusters.set(key, { key, latitude, longitude, events: [event] });
	}
	return [...clusters.values()];
}

function startIdeationText(event: Hackathon): string {
	const tracks = event.tracks
		.map((track) => `${track.title}: ${track.description}`)
		.join("; ");
	return `Help me brainstorm a hackathon project for ${event.title}, organized by ${event.organizer}. Event description: ${event.description}. Tracks: ${tracks || "No tracks published"}. Themes: ${event.tags.map((tag) => tag.name).join(", ")}. Prize pool: ${event.prizeCurrency} ${event.totalPrizeValue}. Suggest an original, achievable student project.`;
}

/** Synchronized event list + Leaflet map with optional browser geolocation. */
export function HackamapsApp() {
	const [region, setRegion] = useState<Region>("india");
	const [search, setSearch] = useState("");
	const [focus, setFocus] = useState<MapFocus>(DEFAULT_FOCUS);
	const [userLocation, setUserLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [nearbyOnly, setNearbyOnly] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<Hackathon | null>(null);
	const [detailEvent, setDetailEvent] = useState<Hackathon | null>(null);
	const [locationError, setLocationError] = useState("");
	const savedIds = useWindowManager((state) => state.savedHackathonIds);
	const toggleSaved = useWindowManager((state) => state.toggleSavedHackathon);
	const setIdeaContext = useWindowManager(
		(state) => state.setPendingHackathonIdea,
	);
	const openWindow = useWindowManager((state) => state.openWindow);

	const visibleEvents = useMemo(
		() =>
			MOCK_HACKATHONS.filter((event) => {
				if (!inRegion(event, region)) return false;
				const text =
					`${event.title} ${event.organizer} ${event.venueCity ?? ""} ${event.venueCountry ?? ""}`.toLocaleLowerCase();
				if (search && !text.includes(search.toLocaleLowerCase().trim()))
					return false;
				if (
					nearbyOnly &&
					(!userLocation ||
						!event.coordinates ||
						distanceKm(userLocation, event.coordinates) > 200)
				)
					return false;
				return true;
			}),
		[nearbyOnly, region, search, userLocation],
	);
	const clusters = useMemo(() => clusterEvents(visibleEvents), [visibleEvents]);

	function locateMe() {
		setLocationError("");
		if (!navigator.geolocation) {
			setLocationError("Geolocation is not available in this browser.");
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const point = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				};
				setUserLocation(point);
				setNearbyOnly(true);
				setRegion("india");
				setFocus({ ...point, zoom: 7 });
			},
			(error) => {
				const message =
					error.code === error.PERMISSION_DENIED
						? "Location permission was denied. You can still browse the map."
						: error.code === error.POSITION_UNAVAILABLE
							? "Your location could not be determined."
							: "Location lookup timed out. Try again.";
				setLocationError(message);
			},
			{ enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
		);
	}

	function chooseRegion(nextRegion: Region) {
		setNearbyOnly(false);
		setRegion(nextRegion);
		setSelectedEvent(null);
		setFocus(DEFAULT_FOCUS);
	}

	function selectEvent(event: Hackathon) {
		setSelectedEvent(event);
		if (event.coordinates) {
			setFocus({
				latitude: event.coordinates.latitude,
				longitude: event.coordinates.longitude,
				zoom: 10,
			});
		}
	}

	function openIdeator(event: Hackathon) {
		setIdeaContext(startIdeationText(event));
		setDetailEvent(null);
		setSelectedEvent(null);
		openWindow("copilot");
	}

	return (
		<section className="relative flex h-full min-h-[420px] flex-col overflow-hidden bg-[#11141c] text-white">
			<header className="z-[500] shrink-0 border-b border-white/[0.08] bg-[#11141c] px-3 py-3 sm:px-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
							<Globe2 className="size-3" />
							HACKAMAPS EXPLORER
						</p>
						<h1 className="mt-1 text-sm font-semibold">
							Find events by place.
						</h1>
					</div>
					<button
						type="button"
						onClick={locateMe}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-100/20 bg-emerald-100/[0.06] px-3 text-[10px] text-emerald-50 transition hover:bg-emerald-100/10"
					>
						<Crosshair className="size-3.5" />
						Locate me · 200 km
					</button>
				</div>
				<div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
					{REGION_LABELS.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => chooseRegion(item.id)}
							aria-pressed={region === item.id && !nearbyOnly}
							className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[9px] transition ${region === item.id && !nearbyOnly ? "border-emerald-100/25 bg-emerald-100/10 text-emerald-50" : "border-white/[0.08] text-white/45 hover:text-white/75"}`}
						>
							{item.label}
						</button>
					))}
				</div>
			</header>
			{locationError && (
				<p
					role="alert"
					className="z-[500] flex items-center gap-2 border-b border-rose-200/10 bg-rose-200/[0.05] px-4 py-2 text-[10px] text-rose-100/80"
				>
					<AlertCircle className="size-3.5 shrink-0" />
					{locationError}
					<button
						type="button"
						onClick={() => setLocationError("")}
						aria-label="Dismiss location error"
						className="ml-auto"
					>
						<span aria-hidden="true">×</span>
					</button>
				</p>
			)}
			<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,340px)_1fr]">
				<aside className="order-2 flex min-h-0 flex-col border-t border-white/[0.08] bg-[#11141c] lg:order-1 lg:border-r lg:border-t-0">
					<div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
						<Search className="size-3.5 text-white/35" />
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search places or events"
							aria-label="Search mapped hackathons"
							className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-white/30"
						/>
						<span className="text-[9px] text-white/30">
							{visibleEvents.length}
						</span>
					</div>
					<div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
						{visibleEvents.map((event) => (
							<MapEventCard
								key={event.id}
								event={event}
								selected={selectedEvent?.id === event.id}
								saved={savedIds.includes(event.id)}
								onSelect={selectEvent}
								onBookmark={(item) => toggleSaved(item.id)}
								onInspect={(item) => {
									selectEvent(item);
									setDetailEvent(item);
								}}
							/>
						))}
						{visibleEvents.length === 0 && (
							<p className="rounded-lg border border-dashed border-white/10 p-5 text-center text-[10px] leading-5 text-white/40">
								No events match this region and search.
							</p>
						)}
					</div>
				</aside>
				<div className="relative order-1 min-h-[300px] bg-[#131820] lg:order-2">
					<MapCanvas
						clusters={clusters}
						focus={focus}
						userLocation={userLocation}
						selectedEventId={selectedEvent?.id ?? null}
						onSelect={selectEvent}
						onInspect={setDetailEvent}
					/>
					{region === "online" && (
						<p className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#11141c]/85 px-4 py-3 text-center text-[10px] leading-5 text-white/60 backdrop-blur">
							Online events have no venue pins.
							<br />
							Browse the synchronized event list.
						</p>
					)}
					<div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11141c]/85 px-2.5 py-1.5 text-[9px] text-white/55 backdrop-blur">
						<Navigation className="size-3 text-emerald-100" />
						{nearbyOnly
							? `${visibleEvents.length} within 200 km`
							: `${clusters.length} map clusters`}
						<span className="text-white/20">·</span>OpenStreetMap
					</div>
					<button
						type="button"
						onClick={() => {
							setNearbyOnly(false);
							setRegion("india");
							setFocus(DEFAULT_FOCUS);
						}}
						aria-label="Reset map view"
						className="absolute bottom-3 right-3 z-[400] grid size-8 place-items-center rounded-lg border border-white/10 bg-[#11141c]/90 text-white/65 backdrop-blur hover:text-white"
					>
						<MapPin className="size-3.5" />
					</button>
				</div>
			</div>
			<HackathonDetailDrawer
				event={detailEvent}
				onClose={() => setDetailEvent(null)}
				onIdeate={openIdeator}
			/>
		</section>
	);
}
