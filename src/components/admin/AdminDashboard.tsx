"use client";

import {
	Activity,
	CalendarDays,
	MapPin,
	RefreshCw,
	ShieldCheck,
	UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

const summarySchema = z.object({
	events: z.object({
		total: z.number(),
		upcoming: z.number(),
		open: z.number(),
		closed: z.number(),
		ended: z.number(),
	}),
	categories: z.array(z.object({ name: z.string(), total: z.number() })),
	locations: z.array(z.object({ name: z.string(), total: z.number() })),
	colleges: z.array(z.object({ name: z.string(), total: z.number() })),
	members: z.object({
		total: z.number(),
		verified: z.number(),
		current: z.number(),
		alumni: z.number(),
		mentors: z.number(),
	}),
	activity: z.object({
		teammateMatches: z.number(),
		projectPlans: z.number(),
		topMembers: z.array(
			z.object({
				userId: z.string(),
				name: z.string(),
				email: z.string(),
				teammateMatches: z.number(),
				projectPlans: z.number(),
				lastUsedAt: z.string().nullable(),
			}),
		),
	}),
});
type Summary = z.infer<typeof summarySchema>;

function dateLabel(value: string | null): string {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeZone: "Asia/Kolkata",
	}).format(new Date(value));
}

/** Admin overview backed by protected, live database aggregates. */
export function AdminDashboard() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/admin/summary", { cache: "no-store" });
			const payload: unknown = await response.json();
			if (!response.ok) throw new Error("Admin summary could not be loaded.");
			const parsed = summarySchema.safeParse(payload);
			if (!parsed.success) throw new Error("The summary response was invalid.");
			setSummary(parsed.data);
			setError("");
		} catch (caught: unknown) {
			setError(
				caught instanceof Error ? caught.message : "Summary unavailable.",
			);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<main className="os-standalone-screen admin-dashboard min-h-dvh bg-[#0e1118] px-4 py-6 text-white sm:px-8 sm:py-10">
			<div className="mx-auto max-w-7xl">
				<AdminNavigation active="overview" />
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">
							<ShieldCheck size={15} /> DeScience administration
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight">
							Club activity overview
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
							Review published event coverage, the member roster, and how often
							students use team matching and project planning.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void refresh()}
						disabled={loading}
						className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-3 text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
					>
						<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />{" "}
						Refresh
					</button>
				</div>
				{error && (
					<p
						role="alert"
						className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100"
					>
						{error}
					</p>
				)}
				{loading && !summary ? (
					<p role="status" className="mt-8 text-sm text-white/60">
						Loading club summary…
					</p>
				) : (
					summary && (
						<>
							<section
								aria-label="Hackathon summary"
								className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
							>
								<Metric
									label="Published events"
									value={summary.events.total}
									icon={<CalendarDays />}
								/>
								<Metric label="Upcoming" value={summary.events.upcoming} />
								<Metric label="Registration open" value={summary.events.open} />
								<Metric label="Closed" value={summary.events.closed} />
								<Metric label="Ended" value={summary.events.ended} />
							</section>
							<section className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
								<Panel title="Member master" icon={<UsersRound />}>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
										<MiniMetric label="Roster" value={summary.members.total} />
										<MiniMetric
											label="Verified"
											value={summary.members.verified}
										/>
										<MiniMetric
											label="Current"
											value={summary.members.current}
										/>
										<MiniMetric label="Alumni" value={summary.members.alumni} />
										<MiniMetric
											label="Mentors"
											value={summary.members.mentors}
										/>
									</div>
								</Panel>
								<Panel title="Feature use" icon={<Activity />}>
									<div className="grid grid-cols-2 gap-3">
										<MiniMetric
											label="Find a teammate"
											value={summary.activity.teammateMatches}
										/>
										<MiniMetric
											label="Plan a project"
											value={summary.activity.projectPlans}
										/>
									</div>
									<p className="mt-3 text-xs leading-5 text-white/45">
										Counts are successful feature runs by signed-in members.
										Prompt and output content is not collected.
									</p>
								</Panel>
							</section>
							<section className="mt-4 grid gap-4 lg:grid-cols-2">
								<RankPanel
									title="Hackathons by category"
									rows={summary.categories.map((row) => ({
										label: row.name,
										count: row.total,
									}))}
									empty="No published events have categories yet."
								/>
								<RankPanel
									title="Hackathons by location"
									rows={summary.locations.map((row) => ({
										label: row.name,
										count: row.total,
									}))}
									empty="No published event locations yet."
									icon={<MapPin size={16} />}
								/>
							</section>
							<section className="mt-4 grid gap-4 lg:grid-cols-2">
								<RankPanel
									title="Members by college"
									rows={summary.colleges.map((row) => ({
										label: row.name,
										count: row.total,
									}))}
									empty="No college details in the member roster."
									icon={<UsersRound size={16} />}
								/>
							</section>
							<section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#151a24]">
								<div className="border-b border-white/10 px-5 py-4">
									<h2 className="font-semibold">Member feature activity</h2>
									<p className="mt-1 text-xs text-white/45">
										Top users, ranked by completed matching and project planning
										runs.
									</p>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[720px] text-left text-sm">
										<thead className="bg-white/[.03] text-xs text-white/50">
											<tr>
												<th className="px-5 py-3 font-medium">Member</th>
												<th className="px-4 py-3 font-medium">
													Teammate matches
												</th>
												<th className="px-4 py-3 font-medium">Project plans</th>
												<th className="px-4 py-3 font-medium">Total runs</th>
												<th className="px-4 py-3 font-medium">Last used</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-white/[.06]">
											{summary.activity.topMembers.map((member) => (
												<tr key={member.userId} className="text-white/75">
													<td className="px-5 py-3">
														<span className="block font-medium text-white/90">
															{member.name}
														</span>
														<span className="mt-0.5 block text-xs text-white/45">
															{member.email}
														</span>
													</td>
													<td className="px-4 py-3 tabular-nums">
														{member.teammateMatches}
													</td>
													<td className="px-4 py-3 tabular-nums">
														{member.projectPlans}
													</td>
													<td className="px-4 py-3 font-semibold tabular-nums">
														{member.teammateMatches + member.projectPlans}
													</td>
													<td className="px-4 py-3 text-xs text-white/50">
														{dateLabel(member.lastUsedAt)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{summary.activity.topMembers.length === 0 && (
										<p className="px-5 py-8 text-sm text-white/50">
											No tracked member activity yet. New successful runs will
											appear here.
										</p>
									)}
								</div>
							</section>
						</>
					)
				)}
			</div>
		</main>
	);
}

function Metric({
	label,
	value,
	icon,
}: {
	label: string;
	value: number;
	icon?: React.ReactNode;
}) {
	return (
		<article className="rounded-2xl border border-white/10 bg-[#151a24] p-4">
			<p className="flex items-center gap-2 text-xs text-white/50">
				{icon && <span className="text-cyan-200">{icon}</span>}
				{label}
			</p>
			<p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
		</article>
	);
}
function MiniMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-white/[.07] bg-black/15 p-3">
			<p className="text-[11px] text-white/45">{label}</p>
			<p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
		</div>
	);
}
function Panel({
	title,
	icon,
	children,
}: {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-white/10 bg-[#151a24] p-5">
			<h2 className="mb-4 flex items-center gap-2 font-semibold">
				<span className="text-cyan-200">{icon}</span>
				{title}
			</h2>
			{children}
		</section>
	);
}
function RankPanel({
	title,
	rows,
	empty,
	icon = <Activity size={16} />,
}: {
	title: string;
	rows: Array<{ label: string; count: number }>;
	empty: string;
	icon?: React.ReactNode;
}) {
	const max = Math.max(1, ...rows.map((row) => row.count));
	return (
		<Panel title={title} icon={icon}>
			{rows.length ? (
				<ul className="space-y-3">
					{rows.map((row) => (
						<li key={row.label}>
							<div className="mb-1 flex justify-between gap-3 text-xs">
								<span className="truncate text-white/75">{row.label}</span>
								<span className="tabular-nums text-white/50">{row.count}</span>
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]">
								<div
									className="h-full rounded-full bg-cyan-200/80"
									style={{ width: `${Math.max(3, (row.count / max) * 100)}%` }}
								/>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-white/45">{empty}</p>
			)}
		</Panel>
	);
}
