"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowUpRight,
	Bot,
	CalendarDays,
	MapPin,
	Trophy,
	X,
} from "lucide-react";
import type { Hackathon } from "@/types/hackathon";

interface HackathonDetailDrawerProps {
	event: Hackathon | null;
	onClose: () => void;
	onIdeate: (event: Hackathon) => void;
}

const COMMUNITY_URL = "https://membership.descienceosclub.com/";

/** Event inspection lives in a modal-like side sheet and remains within the OS window. */
export function HackathonDetailDrawer({
	event,
	onClose,
	onIdeate,
}: HackathonDetailDrawerProps) {
	useEffect(() => {
		if (!event) return;
		function handleEscape(keyboardEvent: KeyboardEvent) {
			if (keyboardEvent.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [event, onClose]);

	return (
		<AnimatePresence>
			{event && (
				<motion.div
					className="absolute inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onMouseDown={(pointerEvent) => {
						if (pointerEvent.target === pointerEvent.currentTarget) onClose();
					}}
				>
					<motion.aside
						role="dialog"
						aria-modal="true"
						aria-labelledby="hackathon-detail-title"
						className="flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#141720] shadow-2xl"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 28 }}
					>
						<header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
							<div>
								<p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
									EVENT DOSSIER
								</p>
								<h2
									id="hackathon-detail-title"
									className="mt-1 text-sm font-semibold text-white"
								>
									Hackathon details
								</h2>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close event details"
								className="grid size-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:text-white"
							>
								<X className="size-4" />
							</button>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto p-5">
							<div className="rounded-xl border border-cyan-100/10 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,.16),transparent_70%),#191d28] p-4">
								<p className="text-[10px] uppercase tracking-widest text-cyan-100/70">
									{event.format === "in-person" ? "In person" : event.format} ·{" "}
									{event.venueCity
										? `${event.venueCity}, ${event.venueCountry ?? ""}`
										: "Remote participation"}
								</p>
								<h3 className="mt-2 text-lg font-semibold leading-snug text-white">
									{event.title}
								</h3>
								<p className="mt-1 text-xs text-white/45">
									Organized by {event.organizer}
								</p>
								<p className="mt-3 text-xs leading-5 text-white/65">
									{event.description}
								</p>
								<div className="mt-4 rounded-lg border border-amber-100/15 bg-amber-100/[0.06] p-3">
									<p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100/65">
										Total prize pool
									</p>
									<p className="mt-1 text-xl font-bold text-amber-100">
										{new Intl.NumberFormat("en", {
											style: "currency",
											currency: event.prizeCurrency,
											maximumFractionDigits: 0,
										}).format(event.totalPrizeValue)}
										<span className="ml-2 text-xs font-normal text-white/45">
											{event.prizeCurrency} total prizes
										</span>
									</p>
								</div>
								<div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-white/65">
									<span className="flex items-center gap-2 rounded-lg bg-black/15 p-2">
										<CalendarDays className="size-3.5 text-cyan-100" />
										{new Intl.DateTimeFormat("en", {
											month: "short",
											day: "numeric",
											year: "numeric",
											timeZone: "Asia/Kolkata",
										}).format(new Date(event.startDate))}
										<span aria-hidden="true">–</span>
										{new Intl.DateTimeFormat("en", {
											month: "short",
											day: "numeric",
											year: "numeric",
											timeZone: "Asia/Kolkata",
										}).format(new Date(event.endDate))}
									</span>
									<span className="flex items-center gap-2 rounded-lg bg-black/15 p-2">
										<MapPin className="size-3.5 text-cyan-100" />
										{event.format === "online"
											? "Online · join anywhere"
											: [event.venueCity, event.venueCountry]
													.filter(Boolean)
													.join(", ") || "Location to be announced"}
									</span>
									<span className="flex items-center gap-2 rounded-lg bg-black/15 p-2">
										<Trophy className="size-3.5 text-amber-100" />
										Status: {event.applicationStatus}
									</span>
									<span className="flex items-center gap-2 rounded-lg bg-black/15 p-2">
										<CalendarDays className="size-3.5 text-cyan-100" />
										Registration:{" "}
										{event.registrationDeadline
											? new Intl.DateTimeFormat("en", {
													dateStyle: "medium",
													timeZone: "Asia/Kolkata",
												}).format(new Date(event.registrationDeadline))
											: "Deadline not listed"}
									</span>
								</div>
							</div>
							<section className="mt-5">
								<h3 className="flex items-center gap-2 text-xs font-semibold text-white">
									<Trophy className="size-4 text-amber-200" />
									Tracks & prizes
								</h3>
								<div className="mt-2 space-y-2">
									{event.tracks.length ? (
										event.tracks.map((track) => (
											<article
												key={track.id}
												className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3"
											>
												<div className="flex items-start justify-between gap-3">
													<h4 className="text-xs font-medium text-white/85">
														{track.title}
													</h4>
													<span className="shrink-0 text-[10px] font-semibold text-amber-100">
														{new Intl.NumberFormat("en", {
															style: "currency",
															currency: event.prizeCurrency,
															maximumFractionDigits: 0,
														}).format(track.prizeAmount)}
													</span>
												</div>
												<p className="mt-1 text-[11px] leading-5 text-white/45">
													{track.description}
												</p>
											</article>
										))
									) : (
										<p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] text-white/40">
											Track details have not been published.
										</p>
									)}
								</div>
							</section>
							<section className="mt-5">
								<h3 className="text-xs font-semibold text-white">
									Eligibility
								</h3>
								<p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.025] p-3 text-[11px] leading-5 text-white/55">
									{event.eligibilityRules}
								</p>
							</section>
							<section className="mt-4">
								<h3 className="text-xs font-semibold text-white">
									Submission guidelines
								</h3>
								<p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.025] p-3 text-[11px] leading-5 text-white/55">
									{event.submissionGuidelines}
								</p>
							</section>
							<a
								href={COMMUNITY_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-fuchsia-200/15 bg-fuchsia-200/[0.055] p-4 transition hover:border-fuchsia-200/30"
							>
								<span>
									<span className="block text-xs font-semibold text-fuchsia-100">
										Looking for teammates?
									</span>
									<span className="mt-1 block text-[10px] text-white/45">
										Find builders in the DeScience community.
									</span>
								</span>
								<ArrowUpRight className="size-4 shrink-0 text-fuchsia-100" />
							</a>
						</div>
						<footer className="flex shrink-0 gap-2 border-t border-white/10 p-4">
							<button
								type="button"
								onClick={() => onIdeate(event)}
								className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-100 text-xs font-semibold text-[#102026] transition hover:bg-white"
							>
								<Bot className="size-4" />
								Ideate with AI
							</button>
							<a
								href={event.websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/70 hover:text-white"
							>
								{event.verified ? "Official site" : "Source directory"}
								<ArrowUpRight className="size-3.5" />
							</a>
						</footer>
					</motion.aside>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
