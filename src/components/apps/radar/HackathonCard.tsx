"use client";

import { useEffect, useState } from "react";
import {
	BadgeCheck,
	Bookmark,
	CalendarPlus,
	Clock3,
	ExternalLink,
	MapPin,
} from "lucide-react";
import type { Hackathon } from "@/types/hackathon";

interface HackathonCardProps {
	event: Hackathon;
	compact?: boolean;
	saved?: boolean;
	onBookmark?: (event: Hackathon) => void;
	onInspect?: (event: Hackathon) => void;
}

function formatPrize(event: Hackathon): string {
	return new Intl.NumberFormat("en", {
		style: "currency",
		currency: event.prizeCurrency,
		maximumFractionDigits: 0,
	}).format(event.totalPrizeValue);
}

function formatDates(event: Hackathon): string {
	const formatter = new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		timeZone: "Asia/Kolkata",
	});
	return `${formatter.format(new Date(event.startDate))} – ${formatter.format(new Date(event.endDate))}`;
}

function deadlineText(
	deadline: string | null,
	now: number,
): { text: string; urgent: boolean; expired: boolean } {
	if (!deadline)
		return { text: "No deadline listed", urgent: false, expired: false };
	if (now === 0)
		return { text: "Registration deadline", urgent: false, expired: false };
	const remaining = Date.parse(deadline) - now;
	if (remaining <= 0)
		return { text: "Registration closed", urgent: false, expired: true };
	if (remaining < 48 * 60 * 60 * 1000) {
		const totalSeconds = Math.floor(remaining / 1000);
		const hours = Math.floor(totalSeconds / 3600)
			.toString()
			.padStart(2, "0");
		const minutes = Math.floor((totalSeconds % 3600) / 60)
			.toString()
			.padStart(2, "0");
		const seconds = (totalSeconds % 60).toString().padStart(2, "0");
		return {
			text: `${hours}:${minutes}:${seconds}`,
			urgent: true,
			expired: false,
		};
	}
	return {
		text: `${Math.ceil(remaining / 86_400_000)} days left`,
		urgent: false,
		expired: false,
	};
}

function locationText(event: Hackathon): string {
	if (event.format === "online") return "Online · Join anywhere";
	return (
		[event.venueCity, event.venueCountry].filter(Boolean).join(", ") ||
		"Location to be announced"
	);
}

function dateForCalendar(value: string): string {
	return new Date(value)
		.toISOString()
		.replaceAll("-", "")
		.replaceAll(":", "")
		.replace(/\.\d{3}/, "");
}

function addToCalendar(event: Hackathon): void {
	const start = dateForCalendar(event.startDate);
	const end = dateForCalendar(event.endDate);
	const title = encodeURIComponent(event.title);
	const details = encodeURIComponent(
		`${event.description}\n\nOfficial event: ${event.websiteUrl}`,
	);
	const location = encodeURIComponent(locationText(event));
	const googleCalendar = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
	window.open(googleCalendar, "_blank", "noopener,noreferrer");
}

/** Compact, keyboard-accessible event summary shared by card, list and map views. */
export function HackathonCard({
	event,
	compact = false,
	saved = false,
	onBookmark,
	onInspect,
}: HackathonCardProps) {
	const [now, setNow] = useState(0);
	useEffect(() => {
		const tick = () => setNow(Date.now());
		tick();
		const deadlineTime = event.registrationDeadline
			? Date.parse(event.registrationDeadline)
			: Number.POSITIVE_INFINITY;
		const remaining = deadlineTime - Date.now();
		const cadence =
			remaining >= 0 && remaining < 48 * 60 * 60 * 1000 ? 1000 : 60_000;
		const timer = window.setInterval(tick, cadence);
		return () => window.clearInterval(timer);
	}, [event.registrationDeadline]);

	const deadline = deadlineText(event.registrationDeadline, now);
	const organizerMark = event.organizer
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<article
			className={`group overflow-hidden rounded-xl border border-white/10 bg-[#171a23]/90 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/35 hover:shadow-lg hover:shadow-black/20 ${compact ? "flex flex-col gap-3 p-4 sm:flex-row sm:items-center" : "p-4"}`}
		>
			{!compact && (
				<div className="relative mb-4 flex h-28 items-center justify-between overflow-hidden rounded-lg border border-white/[0.06] bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.24),transparent_62%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.2),transparent_60%),linear-gradient(135deg,#1d2730,#181721)] px-4">
					{event.bannerUrl ? (
						<div
							aria-hidden="true"
							className="absolute inset-0 size-full bg-cover bg-center opacity-50"
							style={{ backgroundImage: `url("${event.bannerUrl}")` }}
						/>
					) : (
						<div
							aria-hidden="true"
							className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,.05)_31%,transparent_32%),linear-gradient(25deg,transparent_65%,rgba(255,255,255,.045)_66%,transparent_67%)]"
						/>
					)}
					<span className="relative grid size-10 place-items-center rounded-xl border border-white/15 bg-black/25 font-mono text-xs font-bold text-cyan-50 backdrop-blur-sm">
						{organizerMark}
					</span>
					<div className="relative flex flex-wrap items-center justify-end gap-2">
						{event.verified && (
							<span className="inline-flex items-center gap-1 rounded-full border border-cyan-100/20 bg-black/35 px-2.5 py-1 text-[10px] text-cyan-100">
								<BadgeCheck className="size-3" />
								Verified
							</span>
						)}
						<span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] capitalize text-white/80 backdrop-blur-sm">
							{event.format === "in-person" ? "In person" : event.format}
						</span>
					</div>
				</div>
			)}
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-200/85">
					<span>{event.tags[0]?.name ?? "Hackathon"}</span>
					<span className="text-white/20">·</span>
					<span className="text-white/45">{formatDates(event)}</span>
				</div>
				<h2 className="mt-2 text-sm font-semibold leading-snug text-white group-hover:text-cyan-50">
					{event.title}
				</h2>
				<p className="mt-1 text-[11px] text-white/45">
					Hosted by {event.organizer}
					{!event.verified && (
						<span className="ml-2 rounded bg-amber-100/[0.08] px-1.5 py-0.5 text-[9px] text-amber-100/65">
							SAMPLE
						</span>
					)}
				</p>
				{!compact && (
					<p className="mt-3 line-clamp-2 text-xs leading-5 text-white/55">
						{event.description}
					</p>
				)}
				<div className="mt-3 flex flex-wrap gap-1.5">
					{event.tags.map((tag) => (
						<span
							key={tag.id}
							className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] text-white/55"
						>
							{tag.name}
						</span>
					))}
				</div>
			</div>
			<div
				className={`${compact ? "flex flex-wrap items-center gap-3 sm:max-w-[300px] sm:justify-end" : "mt-4 border-t border-white/[0.07] pt-3"}`}
			>
				<p className="text-sm font-semibold text-amber-100">
					{formatPrize(event)}{" "}
					<span className="text-[10px] font-normal text-white/35">
						in prizes
					</span>
				</p>
				<p
					className={`mt-1 flex items-center gap-1.5 text-[11px] ${deadline.expired ? "text-rose-300/75" : deadline.urgent ? "text-amber-200" : "text-emerald-200/80"}`}
				>
					<Clock3 className="size-3" />
					<span>
						{deadline.urgent ? `Closes in ${deadline.text}` : deadline.text}
					</span>
				</p>
				<p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
					<MapPin className="size-3" />
					{locationText(event)}
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<a
						href={event.websiteUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-100 px-3 text-[10px] font-semibold text-[#102026] transition hover:bg-white"
					>
						{event.verified ? "Official website" : "Browse source"}{" "}
						<ExternalLink className="size-3" />
					</a>
					<button
						type="button"
						onClick={() => onInspect?.(event)}
						aria-label={`Inspect details for ${event.title}`}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[10px] text-white/70 transition hover:border-white/25 hover:text-white"
					>
						Details
					</button>
					<button
						type="button"
						onClick={() => onBookmark?.(event)}
						aria-pressed={saved}
						aria-label={`${saved ? "Remove bookmark for" : "Bookmark"} ${event.title}`}
						className={`grid size-8 place-items-center rounded-lg border transition ${saved ? "border-amber-100/30 bg-amber-100/10 text-amber-100" : "border-white/10 text-white/55 hover:border-amber-100/25 hover:text-amber-100"}`}
					>
						<Bookmark
							className="size-3.5"
							fill={saved ? "currentColor" : "none"}
						/>
					</button>
					<button
						type="button"
						onClick={() => addToCalendar(event)}
						aria-label={`Add ${event.title} to Google Calendar`}
						className="grid size-8 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-cyan-100/25 hover:text-cyan-100"
					>
						<CalendarPlus className="size-3.5" />
					</button>
				</div>
			</div>
		</article>
	);
}
