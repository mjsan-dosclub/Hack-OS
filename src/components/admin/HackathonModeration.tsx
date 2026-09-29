"use client";

import {
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	LoaderCircle,
	Plus,
	RefreshCw,
	Search,
	ShieldCheck,
	UploadCloud,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import {
	type ApprovedEvent,
	approvedEventsListSchema,
	bulkManualEventsResultSchema,
	manualCreateResultSchema,
	type ReviewEvent,
	reviewActionSchema,
	reviewListSchema,
} from "@/schemas/moderation";

function localDateTime(iso: string | null): string {
	if (!iso) return "";
	const date = new Date(iso);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
		.toISOString()
		.slice(0, 16);
}

function editable(event: ReviewEvent): ReviewEvent {
	return {
		...event,
		startDate: localDateTime(event.startDate),
		endDate: localDateTime(event.endDate),
		registrationDeadline: localDateTime(event.registrationDeadline) || null,
	};
}

function manualDraft(): ReviewEvent {
	return {
		id: crypto.randomUUID(),
		title: "",
		description: "",
		organizer: "",
		websiteUrl: "",
		bannerUrl: null,
		format: "online",
		venueCity: null,
		venueCountry: null,
		startDate: "",
		endDate: "",
		registrationDeadline: null,
		applicationStatus: "upcoming",
		prizeCurrency: "INR",
		totalPrizeValue: 0,
		source: "manual",
		verified: false,
		published: false,
		evidence: [],
	};
}

function shortDate(iso: string): string {
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	}).format(new Date(iso));
}

async function responseError(response: Response): Promise<string> {
	const value: unknown = await response.json().catch(() => null);
	return typeof value === "object" &&
		value !== null &&
		"error" in value &&
		typeof value.error === "string"
		? value.error
		: `Review request failed (${response.status}).`;
}

export function HackathonModeration() {
	const bulkFileRef = useRef<HTMLInputElement>(null);
	const [events, setEvents] = useState<ReviewEvent[]>([]);
	const [draft, setDraft] = useState<ReviewEvent | null>(null);
	const [loading, setLoading] = useState(true);
	const [busyAction, setBusyAction] = useState<
		"create" | "save" | "approve" | "hide" | null
	>(null);
	const busy = busyAction !== null;
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [bannerUploading, setBannerUploading] = useState(false);
	const [bulkUploading, setBulkUploading] = useState(false);
	const [activeTab, setActiveTab] = useState<"approved" | "review" | "create">(
		"approved",
	);
	const [approvedEvents, setApprovedEvents] = useState<ApprovedEvent[]>([]);
	const [approvedLoading, setApprovedLoading] = useState(true);
	const [approvedSearch, setApprovedSearch] = useState("");
	const [approvedStatus, setApprovedStatus] = useState("all");
	const [approvedFormat, setApprovedFormat] = useState("all");
	const [approvedPage, setApprovedPage] = useState(1);
	const [approvedTotal, setApprovedTotal] = useState(0);
	const approvedPageSize = 20;
	const approvedPages = Math.max(
		1,
		Math.ceil(approvedTotal / approvedPageSize),
	);

	const refresh = useCallback(async (selectId?: string) => {
		setLoading(true);
		try {
			const response = await fetch("/api/admin/hackathons", {
				cache: "no-store",
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = reviewListSchema.safeParse(await response.json());
			if (!parsed.success) throw new Error("The review list is invalid.");
			setEvents(parsed.data.events);
			setDraft((current) => {
				const selected =
					parsed.data.events.find((event) => event.id === selectId) ??
					parsed.data.events.find((event) => event.id === current?.id) ??
					parsed.data.events[0];
				return selected ? editable(selected) : null;
			});
			setError("");
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not load events.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const refreshApproved = useCallback(async () => {
		setApprovedLoading(true);
		try {
			const params = new URLSearchParams({
				view: "approved",
				page: String(approvedPage),
				pageSize: String(approvedPageSize),
				search: approvedSearch,
				status: approvedStatus,
				format: approvedFormat,
			});
			const response = await fetch(`/api/admin/hackathons?${params}`, {
				cache: "no-store",
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = approvedEventsListSchema.safeParse(await response.json());
			if (!parsed.success)
				throw new Error("The approved event list is invalid.");
			setApprovedEvents(parsed.data.events);
			setApprovedTotal(parsed.data.total);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not load approved events.",
			);
		} finally {
			setApprovedLoading(false);
		}
	}, [approvedPage, approvedSearch, approvedStatus, approvedFormat]);

	useEffect(() => {
		if (activeTab !== "approved") return;
		const timer = window.setTimeout(() => void refreshApproved(), 250);
		return () => window.clearTimeout(timer);
	}, [activeTab, refreshApproved]);

	async function submit(action: "create" | "save" | "approve" | "hide") {
		if (!draft) return;
		setError("");
		setMessage("");
		let payload: unknown;
		try {
			payload =
				action === "hide"
					? { action, id: draft.id }
					: {
							action,
							event: {
								title: draft.title,
								description: draft.description,
								organizer: draft.organizer,
								websiteUrl: draft.websiteUrl,
								bannerUrl: draft.bannerUrl,
								format: draft.format,
								venueCity: draft.venueCity || null,
								venueCountry: draft.venueCountry || null,
								startDate: new Date(draft.startDate).toISOString(),
								endDate: new Date(draft.endDate).toISOString(),
								registrationDeadline: draft.registrationDeadline
									? new Date(draft.registrationDeadline).toISOString()
									: null,
								applicationStatus: draft.applicationStatus,
								prizeCurrency: draft.prizeCurrency.toUpperCase(),
								totalPrizeValue: draft.totalPrizeValue,
								...(action === "create" ? {} : { id: draft.id }),
							},
						};
		} catch {
			setError("Enter valid event dates before saving.");
			return;
		}
		const parsed = reviewActionSchema.safeParse(payload);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check the review fields.");
			return;
		}
		setBusyAction(action);
		try {
			const response = await fetch("/api/admin/hackathons", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(parsed.data),
			});
			if (!response.ok) throw new Error(await responseError(response));
			let createdId: string | undefined;
			if (action === "create") {
				let responseBody: unknown;
				try {
					responseBody = await response.json();
				} catch {
					throw new Error("The created event response could not be read.");
				}
				const result = manualCreateResultSchema.safeParse(responseBody);
				if (!result.success)
					throw new Error("The created event response is invalid.");
				createdId = result.data.id;
				setIsCreating(false);
				setActiveTab("review");
			}
			await refresh(createdId);
			setMessage(
				action === "create"
					? "Manual event added to the review queue. Check the official page, then approve it to publish."
					: action === "approve"
						? "Event verified and published for members."
						: action === "hide"
							? "Event hidden from members."
							: "Changes saved. Review and approve to publish.",
			);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not save review.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	async function uploadBanner(file: File | undefined) {
		if (!file) return;
		setError("");
		setMessage("");
		setBannerUploading(true);
		try {
			const formData = new FormData();
			formData.set("file", file);
			const response = await fetch("/api/admin/hackathons/banner", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) throw new Error(await responseError(response));
			const result: unknown = await response.json();
			if (
				typeof result !== "object" ||
				result === null ||
				!("url" in result) ||
				typeof result.url !== "string"
			) {
				throw new Error("The banner upload response was invalid.");
			}
			setField("bannerUrl", result.url);
			setMessage("Banner uploaded. Save the event to attach it.");
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Banner upload failed.",
			);
		} finally {
			setBannerUploading(false);
		}
	}

	function setField<K extends keyof ReviewEvent>(
		key: K,
		value: ReviewEvent[K],
	) {
		setDraft((current) => (current ? { ...current, [key]: value } : current));
	}

	function beginManualEntry() {
		setActiveTab("create");
		setDraft(manualDraft());
		setIsCreating(true);
		setError("");
		setMessage("");
	}

	function cancelManualEntry() {
		setIsCreating(false);
		setActiveTab("approved");
		setDraft(events[0] ? editable(events[0]) : null);
		setError("");
		setMessage("");
	}

	async function uploadBulkEvents(file: File | undefined) {
		if (!file) return;
		setBulkUploading(true);
		setError("");
		setMessage("");
		const form = new FormData();
		form.set("file", file);
		try {
			const response = await fetch("/api/admin/hackathons/bulk", {
				method: "POST",
				body: form,
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = bulkManualEventsResultSchema.safeParse(
				await response.json(),
			);
			if (!parsed.success)
				throw new Error("The event import response was invalid.");
			setMessage(
				`${parsed.data.added} event${parsed.data.added === 1 ? " was" : "s were"} added to review. ${parsed.data.duplicatesSkipped} duplicate${parsed.data.duplicatesSkipped === 1 ? " was" : "s were"} skipped. Nothing is published until an administrator verifies and approves it.`,
			);
			setIsCreating(false);
			setActiveTab("review");
			await refresh();
		} catch (caught: unknown) {
			setError(
				caught instanceof Error ? caught.message : "The event upload failed.",
			);
		} finally {
			setBulkUploading(false);
			if (bulkFileRef.current) bulkFileRef.current.value = "";
		}
	}

	return (
		<main className="os-standalone-screen admin-dashboard min-h-dvh bg-[#0e1118] px-4 py-6 text-white sm:px-8 sm:py-10">
			<AdminNavigation active="hackathons" />
			<div className="mx-auto max-w-7xl lg:ml-[17rem]">
				<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
							DeScience OS · Admin
						</p>
						<h1 className="mt-2 text-3xl font-semibold">
							Hackathon management
						</h1>
						<p className="mt-2 max-w-2xl text-sm text-slate-400">
							Manage published events and review manually entered or web-scraped
							submissions.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<input
							ref={bulkFileRef}
							aria-label="Choose hackathon events workbook"
							className="sr-only"
							accept=".xlsx,.xls,.csv"
							type="file"
							disabled={bulkUploading}
							onChange={(event) =>
								void uploadBulkEvents(event.target.files?.[0])
							}
						/>
						<a
							href="/samples/hackathon-bulk-template.csv"
							download
							className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-sm text-white/65 transition hover:bg-white/5"
						>
							Template
						</a>
						<button
							type="button"
							disabled={bulkUploading}
							aria-busy={bulkUploading}
							onClick={() => bulkFileRef.current?.click()}
							className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-200/15 disabled:cursor-wait disabled:opacity-60"
						>
							{bulkUploading ? (
								<LoaderCircle className="animate-spin" size={16} />
							) : (
								<UploadCloud size={16} />
							)}
							{bulkUploading ? "Importing…" : "Bulk upload"}
						</button>
						<button
							type="button"
							onClick={beginManualEntry}
							className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
						>
							<Plus size={16} /> Add hackathon manually
						</button>
						<button
							type="button"
							onClick={() =>
								activeTab === "approved"
									? void refreshApproved()
									: void refresh()
							}
							aria-label="Refresh events"
							className="rounded-xl border border-white/10 p-2"
						>
							<RefreshCw
								className={loading || approvedLoading ? "animate-spin" : ""}
								size={18}
							/>
						</button>
					</div>
				</header>
				{error && (
					<p
						role="alert"
						className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
					>
						{error}
					</p>
				)}
				{message && (
					<p
						role="status"
						className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"
					>
						{message}
					</p>
				)}
				<div
					role="tablist"
					aria-label="Hackathon administration"
					className="mb-5 flex gap-2 border-b border-white/10"
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "approved"}
						onClick={() => setActiveTab("approved")}
						className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "approved" ? "border-emerald-300 text-emerald-200" : "border-transparent text-slate-400 hover:text-white"}`}
					>
						Approved events{" "}
						<span className="ml-1 text-xs text-slate-500">{approvedTotal}</span>
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "review"}
						onClick={() => setActiveTab("review")}
						className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "review" ? "border-emerald-300 text-emerald-200" : "border-transparent text-slate-400 hover:text-white"}`}
					>
						Scraped & manual review
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "create"}
						onClick={beginManualEntry}
						className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "create" ? "border-emerald-300 text-emerald-200" : "border-transparent text-slate-400 hover:text-white"}`}
					>
						Add event
					</button>
				</div>
				{activeTab === "approved" && (
					<section role="tabpanel" aria-label="Approved events">
						<div className="mb-4 flex flex-wrap gap-3">
							<label className="relative min-w-[240px] flex-1">
								<Search
									className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
									size={16}
								/>
								<input
									aria-label="Search approved events"
									value={approvedSearch}
									onChange={(event) => {
										setApprovedSearch(event.target.value);
										setApprovedPage(1);
									}}
									placeholder="Search event title…"
									className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-3 text-sm"
								/>
							</label>
							<label className="text-sm text-slate-400">
								<span className="sr-only">Filter by event format</span>
								<select
									value={approvedFormat}
									onChange={(event) => {
										setApprovedFormat(event.target.value);
										setApprovedPage(1);
									}}
									className="h-full min-w-36 rounded-xl border border-white/10 bg-[#181d25] px-3 py-2.5 text-sm text-slate-100"
								>
									<option value="all">All formats</option>
									<option value="online">Online</option>
									<option value="in-person">In person</option>
									<option value="hybrid">Hybrid</option>
								</select>
							</label>
							<label className="text-sm text-slate-400">
								<span className="sr-only">Filter by event status</span>
								<select
									value={approvedStatus}
									onChange={(event) => {
										setApprovedStatus(event.target.value);
										setApprovedPage(1);
									}}
									className="h-full min-w-40 rounded-xl border border-white/10 bg-[#181d25] px-3 py-2.5 text-sm text-slate-100"
								>
									<option value="all">All statuses</option>
									<option value="open">Open</option>
									<option value="upcoming">Upcoming</option>
									<option value="closed">Closed</option>
									<option value="ended">Completed / ended</option>
								</select>
							</label>
						</div>
						{approvedLoading && approvedEvents.length === 0 && (
							<AdminSkeleton kind="table" />
						)}
						<div
							className={`overflow-x-auto rounded-2xl border border-white/10 ${approvedLoading && approvedEvents.length === 0 ? "hidden" : ""}`}
						>
							<table className="w-full min-w-[920px] border-collapse text-left text-sm">
								<thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
									<tr>
										<th className="px-4 py-3">Event</th>
										<th className="px-4 py-3">Format / location</th>
										<th className="px-4 py-3">Event dates</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3">Source</th>
										<th className="px-4 py-3">Official page</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/10">
									{approvedEvents.map((event) => (
										<tr key={event.id} className="hover:bg-white/[0.025]">
											<td className="px-4 py-3">
												<p className="font-semibold text-slate-100">
													{event.title}
												</p>
												<p className="mt-1 text-xs text-slate-500">
													{event.organizer}
												</p>
											</td>
											<td className="px-4 py-3 capitalize text-slate-300">
												{event.format.replace("-", " ")}
												<p className="mt-1 text-xs text-slate-500">
													{event.format === "online"
														? "Online"
														: [event.venueCity, event.venueCountry]
																.filter(Boolean)
																.join(", ") || "Location not listed"}
												</p>
											</td>
											<td className="px-4 py-3 whitespace-nowrap text-slate-300">
												{shortDate(event.startDate)} –{" "}
												{shortDate(event.endDate)}
											</td>
											<td className="px-4 py-3">
												<span
													className={`rounded-full px-2.5 py-1 text-xs font-medium ${event.applicationStatus === "open" ? "bg-emerald-300/10 text-emerald-200" : event.applicationStatus === "upcoming" ? "bg-cyan-300/10 text-cyan-200" : "bg-slate-400/10 text-slate-300"}`}
												>
													{event.applicationStatus === "ended"
														? "Completed"
														: event.applicationStatus}
												</span>
											</td>
											<td className="px-4 py-3 uppercase text-xs text-slate-400">
												{event.source}
											</td>
											<td className="px-4 py-3">
												<a
													href={event.websiteUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center gap-1 text-cyan-200 hover:underline"
												>
													Open <ExternalLink size={13} />
												</a>
											</td>
										</tr>
									))}
									{!approvedLoading && approvedEvents.length === 0 && (
										<tr>
											<td
												colSpan={6}
												className="px-4 py-12 text-center text-slate-400"
											>
												No approved events match these filters.
											</td>
										</tr>
									)}
								</tbody>
							</table>
							{approvedLoading && (
								<div className="flex items-center justify-center gap-2 border-t border-white/10 p-4 text-sm text-slate-400">
									<LoaderCircle className="animate-spin" size={16} />
									Loading approved events…
								</div>
							)}
						</div>
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
							<span>
								{approvedTotal
									? `Showing ${(approvedPage - 1) * approvedPageSize + 1}–${Math.min(approvedPage * approvedPageSize, approvedTotal)} of ${approvedTotal} approved events`
									: "0 approved events"}
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={approvedPage <= 1}
									onClick={() =>
										setApprovedPage((page) => Math.max(1, page - 1))
									}
									className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40"
								>
									<ChevronLeft size={15} />
									Previous
								</button>
								<span>
									Page {approvedPage} of {approvedPages}
								</span>
								<button
									type="button"
									disabled={approvedPage >= approvedPages}
									onClick={() =>
										setApprovedPage((page) => Math.min(approvedPages, page + 1))
									}
									className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40"
								>
									Next
									<ChevronRight size={15} />
								</button>
							</div>
						</div>
					</section>
				)}
				{activeTab === "review" && loading && <AdminSkeleton kind="review" />}
				{activeTab === "review" &&
					!loading &&
					events.length === 0 &&
					!isCreating && (
						<p className="rounded-2xl border border-white/10 p-8 text-sm text-slate-400">
							No events are waiting for review. Add an event manually or run the
							scraper to start the review queue.
						</p>
					)}
				{(activeTab === "review" || activeTab === "create") && draft && (
					<div
						className={`grid gap-5 ${isCreating ? "" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}
					>
						{!isCreating && (
							<nav aria-label="Events awaiting review" className="space-y-2">
								{events.map((event) => (
									<button
										key={event.id}
										type="button"
										onClick={() => {
											setDraft(editable(event));
											setIsCreating(false);
											setError("");
											setMessage("");
										}}
										className={`w-full rounded-xl border p-4 text-left ${draft.id === event.id ? "border-emerald-300/40 bg-emerald-300/10" : "border-white/10 bg-white/[0.03]"}`}
									>
										<span className="block text-sm font-semibold">
											{event.title}
										</span>
										<span className="mt-1 block text-xs text-slate-400">
											{event.source} ·{" "}
											{event.verified && event.published
												? "Published"
												: "Needs review"}
										</span>
									</button>
								))}
							</nav>
						)}
						<section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
							<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-xs uppercase tracking-[0.15em] text-slate-500">
										{isCreating
											? "Manual event · not yet saved"
											: `Official source · ${draft.source}`}
									</p>
									<h2 className="mt-1 text-xl font-semibold">{draft.title}</h2>
								</div>
								{!isCreating && (
									<a
										href={draft.websiteUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 rounded-xl bg-cyan-100 px-3 py-2 text-sm font-semibold text-slate-950"
									>
										Open official event <ExternalLink size={15} />
									</a>
								)}
							</div>
							{!isCreating && (
								<div className="mb-5 rounded-xl border border-white/10 bg-black/15 p-4 text-xs text-slate-300">
									<p className="font-semibold">Independent source checks</p>
									{draft.evidence.length ? (
										<ul className="mt-2 space-y-1">
											{draft.evidence.map((check) => (
												<li key={`${check.provider}-${check.sourceUrl}`}>
													<a
														href={check.sourceUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-cyan-200 underline"
													>
														{check.provider}
													</a>{" "}
													· {check.checkStatus}
												</li>
											))}
										</ul>
									) : (
										<p className="mt-2 text-slate-500">
											No independent check recorded. Verify against the official
											event page before approval.
										</p>
									)}
								</div>
							)}
							<form
								onSubmit={(event) => {
									event.preventDefault();
									void submit(isCreating ? "create" : "save");
								}}
								className="grid gap-4 sm:grid-cols-2"
							>
								<label className="text-sm">
									Title
									<input
										required
										value={draft.title}
										onChange={(event) => setField("title", event.target.value)}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Organizer
									<input
										required
										value={draft.organizer}
										onChange={(event) =>
											setField("organizer", event.target.value)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm sm:col-span-2">
									Official URL
									<input
										required
										type="url"
										value={draft.websiteUrl}
										onChange={(event) =>
											setField("websiteUrl", event.target.value)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<div className="text-sm sm:col-span-2">
									<label>
										Banner image URL (optional)
										<input
											type="url"
											value={draft.bannerUrl ?? ""}
											placeholder="https://…"
											onChange={(event) =>
												setField("bannerUrl", event.target.value || null)
											}
											className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
										/>
									</label>
									<span className="mt-2 flex flex-wrap items-center gap-3">
										<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5">
											<input
												className="sr-only"
												type="file"
												accept="image/png,image/jpeg,image/webp,image/avif"
												disabled={bannerUploading || busy}
												onChange={(event) => {
													void uploadBanner(event.target.files?.[0]);
													event.currentTarget.value = "";
												}}
											/>
											{bannerUploading && (
												<LoaderCircle className="animate-spin" size={14} />
											)}
											{bannerUploading ? "Uploading banner…" : "Upload banner"}
										</label>
										<span className="text-xs text-slate-500">
											PNG, JPG, WebP or AVIF · max 5 MB
										</span>
									</span>
									{draft.bannerUrl && (
										<div
											role="img"
											aria-label="Event banner preview"
											className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-cover bg-center"
											style={{ backgroundImage: `url("${draft.bannerUrl}")` }}
										/>
									)}
								</div>
								<label className="text-sm sm:col-span-2">
									Description
									<textarea
										rows={4}
										value={draft.description}
										onChange={(event) =>
											setField("description", event.target.value)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Format
									<select
										value={draft.format}
										onChange={(event) =>
											setField(
												"format",
												event.target.value === "online"
													? "online"
													: event.target.value === "hybrid"
														? "hybrid"
														: "in-person",
											)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-[#181d25] p-2"
									>
										<option value="online">Online</option>
										<option value="in-person">In person</option>
										<option value="hybrid">Hybrid</option>
									</select>
								</label>
								<label className="text-sm">
									Registration status
									<select
										value={draft.applicationStatus}
										onChange={(event) =>
											setField(
												"applicationStatus",
												event.target.value === "open"
													? "open"
													: event.target.value === "upcoming"
														? "upcoming"
														: event.target.value === "closed"
															? "closed"
															: "ended",
											)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-[#181d25] p-2"
									>
										<option value="open">Open</option>
										<option value="upcoming">Upcoming</option>
										<option value="closed">Closed</option>
										<option value="ended">Ended</option>
									</select>
								</label>
								<label className="text-sm">
									City
									<input
										value={draft.venueCity ?? ""}
										onChange={(event) =>
											setField("venueCity", event.target.value || null)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Country
									<input
										value={draft.venueCountry ?? ""}
										onChange={(event) =>
											setField("venueCountry", event.target.value || null)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Starts
									<input
										required
										type="datetime-local"
										value={draft.startDate}
										onChange={(event) =>
											setField("startDate", event.target.value)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Ends
									<input
										required
										type="datetime-local"
										value={draft.endDate}
										onChange={(event) =>
											setField("endDate", event.target.value)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<label className="text-sm">
									Registration deadline
									<input
										type="datetime-local"
										value={draft.registrationDeadline ?? ""}
										onChange={(event) =>
											setField(
												"registrationDeadline",
												event.target.value || null,
											)
										}
										className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
									/>
								</label>
								<div className="grid grid-cols-2 gap-2">
									<label className="text-sm">
										Currency
										<input
											maxLength={3}
											value={draft.prizeCurrency}
											onChange={(event) =>
												setField(
													"prizeCurrency",
													event.target.value.toUpperCase(),
												)
											}
											className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
										/>
									</label>
									<label className="text-sm">
										Prize value
										<input
											type="number"
											min={0}
											value={draft.totalPrizeValue}
											onChange={(event) =>
												setField("totalPrizeValue", Number(event.target.value))
											}
											className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2"
										/>
									</label>
								</div>
								<div className="flex flex-wrap gap-2 border-t border-white/10 pt-5 sm:col-span-2">
									{isCreating ? (
										<>
											<button
												disabled={busy}
												type="submit"
												aria-busy={busyAction === "create"}
												className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"
											>
												{busyAction === "create" && (
													<LoaderCircle className="animate-spin" size={15} />
												)}
												{busyAction === "create"
													? "Adding…"
													: "Add to review queue"}
											</button>
											<button
												disabled={busy}
												type="button"
												onClick={cancelManualEntry}
												className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"
											>
												<X size={15} /> Cancel
											</button>
										</>
									) : (
										<>
											<button
												disabled={busy}
												type="submit"
												aria-busy={busyAction === "save"}
												className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"
											>
												{busyAction === "save" && (
													<LoaderCircle className="animate-spin" size={15} />
												)}
												{busyAction === "save" ? "Saving…" : "Save corrections"}
											</button>
											<button
												disabled={busy}
												type="button"
												onClick={() => void submit("approve")}
												className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"
												aria-busy={busyAction === "approve"}
											>
												{busyAction === "approve" ? (
													<LoaderCircle className="animate-spin" size={15} />
												) : (
													<ShieldCheck size={16} />
												)}
												{busyAction === "approve"
													? "Publishing…"
													: "Approve & publish"}
											</button>
											<button
												disabled={busy}
												type="button"
												aria-busy={busyAction === "hide"}
												onClick={() => void submit("hide")}
												className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200"
											>
												{busyAction === "hide" && (
													<LoaderCircle className="animate-spin" size={15} />
												)}
												{busyAction === "hide" ? "Hiding…" : "Hide event"}
											</button>
										</>
									)}
								</div>
							</form>
						</section>
					</div>
				)}
			</div>
		</main>
	);
}
