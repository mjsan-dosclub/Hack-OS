"use client";

import { motion } from "framer-motion";
import {
	ArrowRight,
	CalendarDays,
	MapPin,
	Radar,
	Sparkles,
	UsersRound,
} from "lucide-react";
import { usePublishedHackathons } from "@/hooks/usePublishedHackathons";
import { type AppKey, useWindowManager } from "@/stores/useWindowManager";

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
	}).format(new Date(value));
}

/** Idle desktop launchpad; its event summaries come from the published API. */
export function DesktopDashboard() {
	const { events, loading } = usePublishedHackathons();
	const openWindow = useWindowManager((state) => state.openWindow);
	const visible = useWindowManager(
		(state) =>
			!state.windows.some((window) => window.isOpen && !window.isMinimized),
	);
	const liveEvents = events.filter(
		(event) => new Date(event.endDate).getTime() >= Date.now(),
	);
	const indiaEvents = liveEvents.filter((event) =>
		(event.venueCountry ?? "").toLowerCase().includes("india"),
	);

	function launch(app: AppKey) {
		openWindow(app);
	}

	return visible ? (
		<motion.section
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			transition={{ duration: 0.22 }}
			aria-label="Hack OS desktop launchpad"
			className="desktop-dashboard absolute inset-x-0 bottom-[88px] top-11 z-[2] overflow-y-auto px-5 py-6 sm:px-10 sm:py-9 lg:px-16"
		>
			<div className="mx-auto max-w-6xl">
				<div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] lg:items-end">
					<div className="max-w-2xl">
						<p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--os-accent)]">
							<Sparkles className="size-4" /> DeScience student workspace
						</p>
						<h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
							Find your next build.
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
							Discover reviewed hackathons, explore places to participate, and
							turn an idea into a team-ready plan.
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<LaunchButton
								icon={<Radar className="size-4" />}
								label="Browse events"
								onClick={() => launch("radar")}
								primary
							/>
							<LaunchButton
								icon={<UsersRound className="size-4" />}
								label="Find teammates"
								onClick={() => launch("synergy")}
							/>
							<LaunchButton
								icon={<Sparkles className="size-4" />}
								label="Plan a project"
								onClick={() => launch("copilot")}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<StatCard
							label="Published opportunities"
							value={loading ? "…" : String(liveEvents.length)}
							caption="Reviewed events"
						/>
						<StatCard
							label="India locations"
							value={loading ? "…" : String(indiaEvents.length)}
							caption="In-person or hybrid"
						/>
						<div className="col-span-2 rounded-2xl border border-white/10 bg-[#111923]/55 p-4 backdrop-blur-xl sm:p-5">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
										Next steps
									</p>
									<p className="mt-1 text-sm text-white/80">
										A workspace for discovering and building together.
									</p>
								</div>
								<button
									type="button"
									onClick={() => launch("help")}
									className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--os-accent)] hover:text-white"
								>
									Quick guide <ArrowRight className="size-3.5" />
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-8 border-t border-white/10 pt-5">
					<div className="mb-3 flex items-center justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
								Recently reviewed
							</p>
							<p className="mt-1 text-xs text-white/45">
								Published opportunities from the community radar
							</p>
						</div>
						<button
							type="button"
							onClick={() => launch("radar")}
							className="text-xs font-semibold text-[var(--os-accent)] hover:text-white"
						>
							Open directory
						</button>
					</div>
					{liveEvents.length > 0 ? (
						<div className="grid gap-3 md:grid-cols-2">
							{liveEvents.slice(0, 2).map((event) => (
								<button
									key={event.id}
									type="button"
									onClick={() => launch("radar")}
									className="group rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-[var(--os-accent)]/45 hover:bg-white/[0.06]"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-white group-hover:text-[var(--os-accent)]">
												{event.title}
											</p>
											<p className="mt-1 truncate text-xs text-white/45">
												{event.organizer}
											</p>
										</div>
										<span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize text-white/60">
											{event.format}
										</span>
									</div>
									<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/55">
										<span className="inline-flex items-center gap-1.5">
											<CalendarDays className="size-3.5" />
											{formatDate(event.startDate)}
										</span>
										{event.venueCity && (
											<span className="inline-flex items-center gap-1.5">
												<MapPin className="size-3.5" />
												{event.venueCity}
												{event.venueCountry ? `, ${event.venueCountry}` : ""}
											</span>
										)}
									</div>
								</button>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-4 py-5 text-sm text-white/55">
							{loading
								? "Loading published events…"
								: "No upcoming reviewed events yet. Open the Radar to see the full directory and latest review status."}
						</div>
					)}
				</div>
			</div>
		</motion.section>
	) : null;
}

function LaunchButton({
	icon,
	label,
	onClick,
	primary = false,
}: {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	primary?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={
				primary
					? "inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--os-accent)] px-4 text-sm font-semibold text-[var(--os-accent-foreground)] transition hover:brightness-110"
					: "inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-white/85 transition hover:border-white/30 hover:bg-white/10"
			}
		>
			{icon}
			{label}
		</button>
	);
}

function StatCard({
	label,
	value,
	caption,
}: {
	label: string;
	value: string;
	caption: string;
}) {
	return (
		<div className="rounded-2xl border border-white/10 bg-[#111923]/55 p-4 backdrop-blur-xl sm:p-5">
			<p className="text-[11px] font-semibold text-white/45">{label}</p>
			<p className="mt-2 text-3xl font-semibold tracking-tight text-white">
				{value}
			</p>
			<p className="mt-1 text-[11px] text-white/40">{caption}</p>
		</div>
	);
}
