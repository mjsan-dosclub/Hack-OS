"use client";

import { useEffect, useMemo } from "react";
import { divIcon, type LatLngExpression } from "leaflet";
import {
	Circle,
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
} from "react-leaflet";
import type { Hackathon } from "@/types/hackathon";

export interface HackathonCluster {
	key: string;
	latitude: number;
	longitude: number;
	events: Hackathon[];
	approximateEventIds: string[];
}
export interface MapFocus {
	latitude: number;
	longitude: number;
	zoom: number;
}

interface MapCanvasProps {
	clusters: HackathonCluster[];
	focus: MapFocus;
	userLocation: { latitude: number; longitude: number } | null;
	selectedEventId: string | null;
	onSelect: (event: Hackathon) => void;
	onInspect: (event: Hackathon) => void;
}

function MapFocusController({ focus }: { focus: MapFocus }) {
	const map = useMap();
	useEffect(() => {
		map.flyTo([focus.latitude, focus.longitude], focus.zoom, {
			duration: 0.75,
		});
	}, [focus, map]);
	return null;
}

function MapSizeObserver() {
	const map = useMap();
	useEffect(() => {
		const container = map.getContainer();
		const observer = new ResizeObserver(() => {
			map.invalidateSize({ pan: false });
		});
		observer.observe(container);
		const frame = requestAnimationFrame(() => {
			map.invalidateSize({ pan: false });
		});
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [map]);
	return null;
}

function makePinIcon(count: number, selected: boolean) {
	const label = count > 1 ? `<span class="hackmap-count">${count}</span>` : "";
	return divIcon({
		className: "hackmap-icon",
		html: `<span class="hackmap-pin${selected ? " hackmap-pin-selected" : ""}">${label}<i></i></span>`,
		iconSize: [38, 46],
		iconAnchor: [19, 43],
		popupAnchor: [0, -39],
	});
}

function ClusterMarker({
	cluster,
	selectedEventId,
	onSelect,
	onInspect,
}: {
	cluster: HackathonCluster;
	selectedEventId: string | null;
	onSelect: (event: Hackathon) => void;
	onInspect: (event: Hackathon) => void;
}) {
	const map = useMap();
	const active = cluster.events.some((event) => event.id === selectedEventId);
	const icon = useMemo(
		() => makePinIcon(cluster.events.length, active),
		[active, cluster.events.length],
	);
	const position: LatLngExpression = [cluster.latitude, cluster.longitude];
	return (
		<Marker
			position={position}
			icon={icon}
			title={cluster.events.map((event) => event.title).join(", ")}
			eventHandlers={{
				click: () => {
					map.flyTo(position, Math.max(map.getZoom(), 10), { duration: 0.65 });
					onSelect(cluster.events[0]);
				},
			}}
		>
			<Popup className="hackmap-popup">
				<div className="min-w-[210px] space-y-2">
					<p className="text-[9px] font-semibold uppercase tracking-widest text-cyan-700">
						{cluster.events.length > 1
							? `${cluster.events.length} events in this area`
							: "Hackathon"}
					</p>
					{cluster.events.map((event) => (
						<div
							key={event.id}
							className={`rounded-lg border p-2 ${selectedEventId === event.id ? "border-cyan-600/40 bg-cyan-50" : "border-slate-200"}`}
						>
							<span className="block text-xs font-semibold text-slate-900">
								{event.title}
							</span>
							<span className="mt-1 block text-[10px] text-slate-500">
								{event.prizeCurrency} {event.totalPrizeValue.toLocaleString()}{" "}
								in prizes
							</span>
							{cluster.approximateEventIds.includes(event.id) && (
								<span className="block text-[10px] text-slate-500">
									Approximate city-centre pin
								</span>
							)}
							<button
								type="button"
								onClick={() => {
									onSelect(event);
									onInspect(event);
								}}
								className="mt-2 text-[10px] font-semibold text-cyan-800 underline decoration-cyan-800/30 underline-offset-2 hover:text-cyan-600"
							>
								View details
							</button>
						</div>
					))}
				</div>
			</Popup>
		</Marker>
	);
}

/** Client-only OSM map. Tiles use the cacheable, identifiable same-origin proxy. */
export function MapCanvas({
	clusters,
	focus,
	userLocation,
	selectedEventId,
	onSelect,
	onInspect,
}: MapCanvasProps) {
	return (
		<MapContainer
			center={[focus.latitude, focus.longitude]}
			zoom={focus.zoom}
			scrollWheelZoom
			className="hackmap-canvas"
		>
			<MapFocusController focus={focus} />
			<MapSizeObserver />
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="/api/map-tiles/{z}/{x}/{y}"
				maxZoom={19}
			/>
			{userLocation && (
				<>
					<Circle
						center={[userLocation.latitude, userLocation.longitude]}
						radius={200_000}
						pathOptions={{
							color: "#67e8f9",
							fillColor: "#22d3ee",
							fillOpacity: 0.06,
							weight: 1,
						}}
					/>
					<Circle
						center={[userLocation.latitude, userLocation.longitude]}
						radius={1200}
						pathOptions={{
							color: "#a5f3fc",
							fillColor: "#a5f3fc",
							fillOpacity: 0.9,
							weight: 1,
						}}
					/>
				</>
			)}
			{clusters.map((cluster) => (
				<ClusterMarker
					key={cluster.key}
					cluster={cluster}
					selectedEventId={selectedEventId}
					onSelect={onSelect}
					onInspect={onInspect}
				/>
			))}
		</MapContainer>
	);
}
