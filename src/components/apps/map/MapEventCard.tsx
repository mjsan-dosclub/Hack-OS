"use client";

import { Bookmark, ExternalLink, MapPin } from "lucide-react";
import type { Hackathon } from "@/types/hackathon";

interface MapEventCardProps {
	event: Hackathon;
	selected: boolean;
	saved: boolean;
	onSelect: (event: Hackathon) => void;
	onInspect: (event: Hackathon) => void;
	onBookmark: (event: Hackathon) => void;
}

function formatEventDate(event: Hackathon): string {
	const formatter = new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	return `${formatter.format(new Date(event.startDate))} – ${formatter.format(new Date(event.endDate))}`;
}

function formatPrize(event: Hackathon): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: event.prizeCurrency,
		maximumFractionDigits: 0,
	}).format(event.totalPrizeValue);
}

export function MapEventCard({
	event,
	selected,
	saved,
	onSelect,
	onInspect,
	onBookmark,
}: MapEventCardProps) {
	const location =
		event.format === "online"
			? "Online event"
			: [event.venueCity, event.venueCountry].filter(Boolean).join(", ") ||
				"Location to be announced";

	return (
		<article
			className={`min-w-0 rounded-xl border p-3 transition ${selected ? "border-emerald-100/35 bg-emerald-100/[0.07]" : "border-white/[0.08] bg-[#171a23] hover:border-white/20"}`}
		>
			<div className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
						{event.tags[0]?.name ?? "Hackathon"}{" "}
						<span aria-hidden="true">·</span> {formatEventDate(event)}
					</p>
					<button
						type="button"
						onClick={() => onSelect(event)}
						className="mt-1 block w-full text-left text-sm font-semibold leading-5 text-white hover:text-emerald-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-100"
					>
						<span className="line-clamp-2 break-words">{event.title}</span>
					</button>
					<p className="mt-1 truncate text-[10px] text-white/40">
						{event.organizer}
						{!event.verified && (
							<span className="ml-1.5 text-amber-100/60">· Sample</span>
						)}
					</p>
				</div>
				<p className="shrink-0 text-right text-xs font-semibold text-amber-100">
					{formatPrize(event)}
					<span className="mt-0.5 block text-[9px] font-normal text-white/35">
						prize pool
					</span>
				</p>
			</div>
			<p className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
				<MapPin className="size-3 shrink-0 text-emerald-100/70" />
				<span className="truncate">{location}</span>
			</p>
			<div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
				<button
					type="button"
					onClick={() => onInspect(event)}
					className="inline-flex h-7 min-w-0 flex-1 items-center justify-center rounded-lg border border-white/10 px-2 text-[10px] text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-100"
				>
					Details
				</button>
				<a
					href={event.websiteUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Open ${event.title} source in a new tab`}
					className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-cyan-100/25 hover:text-cyan-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-100"
				>
					<ExternalLink className="size-3.5" />
				</a>
				<button
					type="button"
					onClick={() => onBookmark(event)}
					aria-pressed={saved}
					aria-label={`${saved ? "Remove bookmark for" : "Bookmark"} ${event.title}`}
					className={`grid size-7 shrink-0 place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-100 ${saved ? "border-amber-100/30 bg-amber-100/10 text-amber-100" : "border-white/10 text-white/50 hover:border-amber-100/25 hover:text-amber-100"}`}
				>
					<Bookmark
						className="size-3.5"
						fill={saved ? "currentColor" : "none"}
					/>
				</button>
			</div>
		</article>
	);
}
