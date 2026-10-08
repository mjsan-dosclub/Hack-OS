"use client";

import {
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	Download,
	ExternalLink,
	Eye,
	LoaderCircle,
	Pencil,
	Plus,
	RefreshCw,
	Search,
	ShieldCheck,
	Square,
	Trash2,
	UploadCloud,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { SpreadsheetImportDialog } from "@/components/admin/SpreadsheetImportDialog";
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

function formatPrize(currency: string, value: number): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			maximumFractionDigits: 0,
		}).format(value);
	} catch {
		return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
	}
}

type BulkIssue = z.infer<typeof bulkManualEventsResultSchema>["issues"][number];

function downloadEventIssues(issues: BulkIssue[]) {
	const headers = [
		"title",
		"organizer",
		"official_url",
		"description",
		"banner_url",
		"format",
		"venue_city",
		"venue_country",
		"start_date",
		"end_date",
		"registration_deadline",
		"application_status",
		"prize_currency",
		"total_prize_value",
		"import_issues",
	];
	const csvCell = (value: string): string => {
		const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
		return `"${safeValue.replaceAll('"', '""')}"`;
	};
	const lines = [
		headers.map(csvCell).join(","),
		...issues.map((issue) =>
			[
				issue.values.title,
				issue.values.organizer,
				issue.values.official_url,
				issue.values.description,
				issue.values.banner_url,
				issue.values.format,
				issue.values.venue_city,
				issue.values.venue_country,
				issue.values.start_date,
				issue.values.end_date,
				issue.values.registration_deadline,
				issue.values.application_status,
				issue.values.prize_currency,
				issue.values.total_prize_value,
				`Row ${issue.rowNumber}: ${issue.messages.join("; ")}`,
			]
				.map(csvCell)
				.join(","),
		),
	];
	const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
		type: "text/csv;charset=utf-8",
	});
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = "hackathon-import-issues.csv";
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
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
	const [events, setEvents] = useState<ReviewEvent[]>([]);
	const [draft, setDraft] = useState<ReviewEvent | null>(null);
	const [loading, setLoading] = useState(true);
	const [busyAction, setBusyAction] = useState<
		"create" | "save" | "approve" | "hide" | "update" | null
	>(null);
	const busy = busyAction !== null;
	const [error, setError] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [message, setMessage] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [bannerUploading, setBannerUploading] = useState(false);
	const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
	const [bulkIssues, setBulkIssues] = useState<BulkIssue[]>([]);
	const [bulkSummary, setBulkSummary] = useState<{
		added: number;
		duplicatesSkipped: number;
		issueCount: number;
	} | null>(null);
	const [activeTab, setActiveTab] = useState<
		"approved" | "review" | "create" | "edit"
	>("approved");
	const [approvedEvents, setApprovedEvents] = useState<ApprovedEvent[]>([]);
	const [approvedLoading, setApprovedLoading] = useState(true);
	const [approvedSearch, setApprovedSearch] = useState("");
	const [approvedStatus, setApprovedStatus] = useState("all");
	const [approvedFormat, setApprovedFormat] = useState("all");
	const [approvedPage, setApprovedPage] = useState(1);
	const [approvedTotal, setApprovedTotal] = useState(0);
	const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
	const [previewEvent, setPreviewEvent] = useState<ApprovedEvent | null>(null);
	const [deletingEvents, setDeletingEvents] = useState(false);
	const [generatingDescription, setGeneratingDescription] = useState(false);
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
			setSelectedEventIds((current) =>
				current.filter((id) =>
					parsed.data.events.some((event) => event.id === id),
				),
			);
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

	async function submit(
		action: "create" | "save" | "approve" | "hide" | "update",
	) {
		if (!draft) return;
		setError("");
		setFieldErrors({});
		setMessage("");
		if (action !== "hide") {
			const dateErrors: Record<string, string> = {};
			if (!draft.startDate || !Number.isFinite(Date.parse(draft.startDate))) {
				dateErrors.startDate = "Enter a valid start date and time.";
			}
			if (!draft.endDate || !Number.isFinite(Date.parse(draft.endDate))) {
				dateErrors.endDate = "Enter a valid end date and time.";
			}
			if (
				draft.registrationDeadline &&
				!Number.isFinite(Date.parse(draft.registrationDeadline))
			) {
				dateErrors.registrationDeadline =
					"Enter a valid registration deadline.";
			}
			if (Object.keys(dateErrors).length > 0) {
				setFieldErrors(dateErrors);
				setError("Review the highlighted event date fields before saving.");
				const firstDateField = Object.keys(dateErrors)[0];
				if (firstDateField) {
					window.setTimeout(() => {
						document.getElementById(`event-field-${firstDateField}`)?.focus();
					}, 0);
				}
				return;
			}
		}
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
			setFieldErrors({ endDate: "Enter a valid date and time." });
			setError("Review the highlighted event field before saving.");
			return;
		}
		const parsed = reviewActionSchema.safeParse(payload);
		if (!parsed.success) {
			const nextErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[1] ?? issue.path[0];
				if (typeof field === "string" && !nextErrors[field]) {
					nextErrors[field] = issue.message;
				}
			}
			setFieldErrors(nextErrors);
			setError(
				"Some event details need attention. Use the links below to jump to each field.",
			);
			const firstField = Object.keys(nextErrors)[0];
			if (firstField) {
				window.setTimeout(() => {
					document.getElementById(`event-field-${firstField}`)?.focus();
				}, 0);
			}
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
			if (action === "update") {
				await refreshApproved();
				setActiveTab("approved");
			}
			setMessage(
				action === "create"
					? "Manual event added to the review queue. Check the official page, then approve it to publish."
					: action === "approve"
						? "Event verified and published for members."
						: action === "update"
							? "Published event updated."
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

	function beginApprovedEdit(event: ApprovedEvent) {
		setDraft(
			editable({ ...event, verified: true, published: true, evidence: [] }),
		);
		setIsCreating(false);
		setActiveTab("edit");
		setError("");
		setMessage("");
		setFieldErrors({});
	}

	function toggleEvent(id: string) {
		setSelectedEventIds((current) =>
			current.includes(id)
				? current.filter((value) => value !== id)
				: [...current, id],
		);
	}

	function toggleVisibleEvents() {
		const ids = approvedEvents.map((event) => event.id);
		const allSelected =
			ids.length > 0 && ids.every((id) => selectedEventIds.includes(id));
		setSelectedEventIds((current) =>
			allSelected
				? current.filter((id) => !ids.includes(id))
				: [...new Set([...current, ...ids])],
		);
	}

	async function deleteSelectedEvents() {
		if (selectedEventIds.length === 0) return;
		const count = selectedEventIds.length;
		if (
			!window.confirm(
				`Permanently delete ${count} selected approved ${count === 1 ? "event" : "events"}? Related saved events and event-linked records may also be deleted.`,
			)
		)
			return;
		setDeletingEvents(true);
		setError("");
		try {
			const response = await fetch("/api/admin/hackathons", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: selectedEventIds }),
			});
			if (!response.ok) throw new Error(await responseError(response));
			const result: unknown = await response.json();
			if (
				typeof result !== "object" ||
				result === null ||
				!("deletedCount" in result) ||
				typeof result.deletedCount !== "number"
			)
				throw new Error("The delete response was invalid.");
			setSelectedEventIds([]);
			setMessage(
				`${result.deletedCount} approved ${result.deletedCount === 1 ? "event" : "events"} deleted.`,
			);
			if (approvedEvents.length === count && approvedPage > 1)
				setApprovedPage((page) => page - 1);
			else await refreshApproved();
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not delete selected events.",
			);
		} finally {
			setDeletingEvents(false);
		}
	}

	async function generateDescription() {
		if (!draft || isCreating || !draft.id) return;
		setGeneratingDescription(true);
		setError("");
		try {
			const response = await fetch("/api/admin/hackathons/description", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: draft.id }),
			});
			if (!response.ok) throw new Error(await responseError(response));
			const body: unknown = await response.json();
			if (
				typeof body !== "object" ||
				body === null ||
				!("description" in body) ||
				typeof body.description !== "string"
			)
				throw new Error("The description response was invalid.");
			setField("description", body.description);
			setMessage(
				"AI draft added to the description field. Check it against the official page before saving or publishing.",
			);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not generate a description.",
			);
		} finally {
			setGeneratingDescription(false);
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
		setFieldErrors((current) => {
			if (!(key in current)) return current;
			const next = { ...current };
			delete next[key];
			return next;
		});
	}

	function fieldIssue(field: string) {
		return fieldErrors[field] ? (
			<p className="mt-1 text-xs text-rose-200" id={`event-error-${field}`}>
				{fieldErrors[field]}
			</p>
		) : null;
	}

	function beginManualEntry() {
		setActiveTab("create");
		setDraft(manualDraft());
		setIsCreating(true);
		setError("");
		setFieldErrors({});
		setMessage("");
	}

	function cancelManualEntry() {
		setIsCreating(false);
		setActiveTab("approved");
		setDraft(events[0] ? editable(events[0]) : null);
		setError("");
		setMessage("");
	}

	async function uploadBulkEvents(file: File): Promise<{ summary: string }> {
		setError("");
		setMessage("");
		setBulkIssues([]);
		setBulkSummary(null);
		const form = new FormData();
		form.set("file", file);
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
		setBulkIssues(parsed.data.issues);
		setBulkSummary({
			added: parsed.data.added,
			duplicatesSkipped: parsed.data.duplicatesSkipped,
			issueCount: parsed.data.issueCount,
		});
		setMessage(
			"Import finished. Valid events are in the review queue; nothing is published until an administrator verifies and approves it.",
		);
		setIsCreating(false);
		setActiveTab("review");
		await refresh();
		return {
			summary: `${parsed.data.added} added to review, ${parsed.data.duplicatesSkipped} duplicates skipped, ${parsed.data.issueCount} rows need correction.`,
		};
	}

	return (
		<>
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
								Manage published events and review manually entered or
								web-scraped submissions.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setBulkUploadOpen(true)}
								className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-200/15 disabled:cursor-wait disabled:opacity-60"
							>
								<UploadCloud size={16} /> Bulk upload
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
						<div
							role="alert"
							className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
						>
							<p>{error}</p>
							{Object.keys(fieldErrors).length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{Object.entries(fieldErrors).map(([field, detail]) => (
										<button
											key={field}
											type="button"
											onClick={() =>
												document.getElementById(`event-field-${field}`)?.focus()
											}
											className="rounded-md border border-rose-200/20 px-2 py-1 text-xs underline decoration-dotted underline-offset-2 hover:bg-rose-100/10"
										>
											{field}: {detail}
										</button>
									))}
								</div>
							)}
						</div>
					)}
					{message && (
						<p
							role="status"
							className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"
						>
							{message}
						</p>
					)}
					{bulkSummary && (
						<section
							className="mb-5"
							role="status"
							aria-label="Hackathon import results"
						>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3">
									<p className="text-xs text-emerald-100/65">Added to review</p>
									<p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-100">
										{bulkSummary.added}
									</p>
								</div>
								<div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
									<p className="text-xs text-white/55">Duplicates skipped</p>
									<p className="mt-1 text-2xl font-semibold tabular-nums">
										{bulkSummary.duplicatesSkipped}
									</p>
								</div>
								<div
									className={`rounded-xl border px-4 py-3 ${bulkSummary.issueCount ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-white/10 bg-white/[0.025]"}`}
								>
									<p className="text-xs text-white/55">
										Rows needing correction
									</p>
									<p
										className={`mt-1 text-2xl font-semibold tabular-nums ${bulkSummary.issueCount ? "text-amber-100" : "text-white/75"}`}
									>
										{bulkSummary.issueCount}
									</p>
								</div>
							</div>
							{bulkIssues.length > 0 && (
								<div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<h2 className="text-sm font-semibold text-amber-100">
												{bulkIssues.length} event rows need attention
											</h2>
											<p className="mt-1 text-xs text-amber-100/65">
												Only these rows were skipped. Correct them in the
												downloaded CSV and re-upload it.
											</p>
										</div>
										<button
											type="button"
											onClick={() => downloadEventIssues(bulkIssues)}
											className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-100/20 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-100/10"
										>
											<Download size={14} /> Download issue rows
										</button>
									</div>
									<ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-amber-50/80">
										{bulkIssues.map((issue) => (
											<li
												key={issue.rowNumber}
												className="rounded-lg bg-black/15 px-3 py-2"
											>
												<span className="font-semibold">
													Row {issue.rowNumber}
												</span>
												<span className="ml-2">
													{issue.values.title ||
														issue.values.official_url ||
														"Untitled event"}
												</span>
												<ul className="mt-1 list-inside list-disc text-amber-100/60">
													{issue.messages.map((issueMessage) => (
														<li key={`${issue.rowNumber}-${issueMessage}`}>
															{issueMessage}
														</li>
													))}
												</ul>
											</li>
										))}
									</ul>
								</div>
							)}
						</section>
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
							<span className="ml-1 text-xs text-slate-500">
								{approvedTotal}
							</span>
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
							{selectedEventIds.length > 0 && (
								<div
									className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3"
									role="status"
								>
									<p className="text-sm text-white/75">
										{selectedEventIds.length} approved events selected
									</p>
									<button
										type="button"
										onClick={() => void deleteSelectedEvents()}
										disabled={deletingEvents}
										className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200/25 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-60"
									>
										{deletingEvents ? (
											<LoaderCircle className="animate-spin" size={15} />
										) : (
											<Trash2 size={15} />
										)}
										{deletingEvents ? "Deleting…" : "Delete selected"}
									</button>
								</div>
							)}
							{approvedLoading && approvedEvents.length === 0 && (
								<AdminSkeleton kind="table" />
							)}
							<div
								className={`overflow-x-auto rounded-2xl border border-white/10 ${approvedLoading && approvedEvents.length === 0 ? "hidden" : ""}`}
							>
								<table className="w-full min-w-[920px] border-collapse text-left text-sm">
									<thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
										<tr>
											<th className="w-12 px-4 py-3">
												<button
													type="button"
													aria-label="Select or clear events on this page"
													onClick={toggleVisibleEvents}
													className="rounded p-1 hover:bg-white/10"
												>
													{approvedEvents.length > 0 &&
													approvedEvents.every((event) =>
														selectedEventIds.includes(event.id),
													) ? (
														<CheckSquare size={17} />
													) : (
														<Square size={17} />
													)}
												</button>
											</th>
											<th className="px-4 py-3">Event / prize</th>
											<th className="px-4 py-3">Format / location</th>
											<th className="px-4 py-3">Event dates</th>
											<th className="px-4 py-3">Status</th>
											<th className="px-4 py-3">Source</th>
											<th className="px-4 py-3">Official page</th>
											<th className="px-4 py-3">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/10">
										{approvedEvents.map((event) => (
											<tr key={event.id} className="hover:bg-white/[0.025]">
												<td className="px-4 py-3">
													<input
														type="checkbox"
														aria-label={`Select ${event.title}`}
														checked={selectedEventIds.includes(event.id)}
														onChange={() => toggleEvent(event.id)}
														className="h-4 w-4 accent-cyan-200"
													/>
												</td>
												<td className="px-4 py-3">
													<p className="font-semibold text-slate-100">
														{event.title}
													</p>
													<p className="mt-1 text-xs text-slate-500">
														{event.organizer}
													</p>
													<p className="mt-1 text-xs font-semibold text-amber-200">
														{formatPrize(
															event.prizeCurrency,
															event.totalPrizeValue,
														)}{" "}
														<span className="font-normal text-slate-400">
															{event.prizeCurrency} total prize
														</span>
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
												<td className="px-4 py-3">
													<div className="flex flex-wrap gap-2">
														<button
															type="button"
															onClick={() => setPreviewEvent(event)}
															className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-xs text-white/75 hover:bg-white/5"
														>
															<Eye size={13} /> Preview
														</button>
														<button
															type="button"
															onClick={() => beginApprovedEdit(event)}
															className="inline-flex items-center gap-1 rounded-lg border border-cyan-200/20 px-2.5 py-2 text-xs text-cyan-100 hover:bg-cyan-200/10"
														>
															<Pencil size={13} /> Edit
														</button>
													</div>
												</td>
											</tr>
										))}
										{!approvedLoading && approvedEvents.length === 0 && (
											<tr>
												<td
													colSpan={8}
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
											setApprovedPage((page) =>
												Math.min(approvedPages, page + 1),
											)
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
								No events are waiting for review. Add an event manually or run
								the scraper to start the review queue.
							</p>
						)}
					{(activeTab === "review" ||
						activeTab === "create" ||
						activeTab === "edit") &&
						draft && (
							<div
								className={`grid gap-5 ${activeTab === "review" && !isCreating ? "lg:grid-cols-[280px_minmax(0,1fr)]" : ""}`}
							>
								{!isCreating && activeTab === "review" && (
									<nav
										aria-label="Events awaiting review"
										className="space-y-2"
									>
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
													: activeTab === "edit"
														? "Published event · editing"
														: `Official source · ${draft.source}`}
											</p>
											<h2 className="mt-1 text-xl font-semibold">
												{draft.title}
											</h2>
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
													No independent check recorded. Verify against the
													official event page before approval.
												</p>
											)}
										</div>
									)}
									<form
										onSubmit={(event) => {
											event.preventDefault();
											void submit(
												isCreating
													? "create"
													: activeTab === "edit"
														? "update"
														: "save",
											);
										}}
										className="grid gap-4 sm:grid-cols-2"
									>
										<label className="text-sm">
											Title
											<input
												id="event-field-title"
												required
												value={draft.title}
												onChange={(event) =>
													setField("title", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.title)}
												aria-describedby={
													fieldErrors.title ? "event-error-title" : undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.title ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("title")}
										</label>
										<label className="text-sm">
											Organizer
											<input
												id="event-field-organizer"
												required
												value={draft.organizer}
												onChange={(event) =>
													setField("organizer", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.organizer)}
												aria-describedby={
													fieldErrors.organizer
														? "event-error-organizer"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.organizer ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("organizer")}
										</label>
										<label className="text-sm sm:col-span-2">
											Official URL
											<input
												id="event-field-websiteUrl"
												required
												type="url"
												value={draft.websiteUrl}
												onChange={(event) =>
													setField("websiteUrl", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.websiteUrl)}
												aria-describedby={
													fieldErrors.websiteUrl
														? "event-error-websiteUrl"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.websiteUrl ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("websiteUrl")}
										</label>
										<div className="text-sm sm:col-span-2">
											<label>
												Banner image URL (optional)
												<input
													id="event-field-bannerUrl"
													type="url"
													value={draft.bannerUrl ?? ""}
													placeholder="https://…"
													onChange={(event) =>
														setField("bannerUrl", event.target.value || null)
													}
													aria-invalid={Boolean(fieldErrors.bannerUrl)}
													aria-describedby={
														fieldErrors.bannerUrl
															? "event-error-bannerUrl"
															: undefined
													}
													className={`mt-1 w-full rounded-lg border ${fieldErrors.bannerUrl ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
												/>
												{fieldIssue("bannerUrl")}
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
													{bannerUploading
														? "Uploading banner…"
														: "Upload banner"}
												</label>
												<p className="mt-1 text-xs text-slate-500">
													No custom image? Radar automatically shows a DeScience
													branded banner using the event title and organizer.
												</p>
												<span className="text-xs text-slate-500">
													PNG, JPG, WebP or AVIF · max 5 MB
												</span>
											</span>
											<div
												role="img"
												aria-label={
													draft.bannerUrl
														? "Event banner preview"
														: "Automatic DeScience banner preview; no custom banner selected"
												}
												className={`relative mt-3 flex h-32 w-full items-end overflow-hidden rounded-lg border border-white/10 bg-cover bg-center p-4 ${draft.bannerUrl ? "" : "bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.28),transparent_62%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.22),transparent_60%),linear-gradient(135deg,#1d2730,#181721)]"}`}
												style={
													draft.bannerUrl
														? { backgroundImage: `url("${draft.bannerUrl}")` }
														: undefined
												}
											>
												{draft.bannerUrl && (
													<span
														aria-hidden="true"
														className="absolute inset-0 bg-black/30"
													/>
												)}
												<div className="relative min-w-0">
													<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
														DeScience Events
													</p>
													<p className="mt-1 line-clamp-1 text-lg font-semibold text-white">
														{draft.title || "Your event title"}
													</p>
													<p className="mt-0.5 line-clamp-1 text-xs text-white/75">
														{draft.organizer || "Organizer"}
													</p>
												</div>
											</div>
										</div>
										<div className="grid gap-2 text-sm sm:col-span-2">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<label htmlFor="event-field-description">
													Description
												</label>
												{!isCreating && !draft.description.trim() && (
													<button
														type="button"
														onClick={() => void generateDescription()}
														disabled={generatingDescription || busy}
														className="inline-flex items-center gap-2 rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
													>
														{generatingDescription ? (
															<LoaderCircle
																className="animate-spin"
																size={14}
															/>
														) : null}
														{generatingDescription
															? "Drafting with Ollama…"
															: "Draft description with Ollama"}
													</button>
												)}
											</div>
											<textarea
												id="event-field-description"
												rows={4}
												value={draft.description}
												onChange={(event) =>
													setField("description", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.description)}
												aria-describedby={
													fieldErrors.description
														? "event-error-description"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.description ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("description")}
											{!isCreating && (
												<p className="mt-1 text-xs text-slate-500">
													Ollama only drafts on request. Verify all claims
													against the official event page; the draft is not
													saved or published until you submit this form.
												</p>
											)}
										</div>
										<label className="text-sm">
											Format
											<select
												id="event-field-format"
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
												aria-invalid={Boolean(fieldErrors.format)}
												aria-describedby={
													fieldErrors.format ? "event-error-format" : undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.format ? "border-rose-300/60" : "border-white/10"} bg-[#181d25] p-2`}
											>
												<option value="online">Online</option>
												<option value="in-person">In person</option>
												<option value="hybrid">Hybrid</option>
											</select>
											{fieldIssue("format")}
										</label>
										<label className="text-sm">
											Registration status
											<select
												id="event-field-applicationStatus"
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
												aria-invalid={Boolean(fieldErrors.applicationStatus)}
												aria-describedby={
													fieldErrors.applicationStatus
														? "event-error-applicationStatus"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.applicationStatus ? "border-rose-300/60" : "border-white/10"} bg-[#181d25] p-2`}
											>
												<option value="open">Open</option>
												<option value="upcoming">Upcoming</option>
												<option value="closed">Closed</option>
												<option value="ended">Ended</option>
											</select>
											{fieldIssue("applicationStatus")}
										</label>
										<label className="text-sm">
											City
											<input
												id="event-field-venueCity"
												value={draft.venueCity ?? ""}
												onChange={(event) =>
													setField("venueCity", event.target.value || null)
												}
												aria-invalid={Boolean(fieldErrors.venueCity)}
												aria-describedby={
													fieldErrors.venueCity
														? "event-error-venueCity"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.venueCity ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("venueCity")}
										</label>
										<label className="text-sm">
											Country
											<input
												id="event-field-venueCountry"
												value={draft.venueCountry ?? ""}
												onChange={(event) =>
													setField("venueCountry", event.target.value || null)
												}
												aria-invalid={Boolean(fieldErrors.venueCountry)}
												aria-describedby={
													fieldErrors.venueCountry
														? "event-error-venueCountry"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.venueCountry ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("venueCountry")}
										</label>
										<label className="text-sm">
											Starts
											<input
												id="event-field-startDate"
												required
												type="datetime-local"
												value={draft.startDate}
												onChange={(event) =>
													setField("startDate", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.startDate)}
												aria-describedby={
													fieldErrors.startDate
														? "event-error-startDate"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.startDate ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("startDate")}
										</label>
										<label className="text-sm">
											Ends
											<input
												id="event-field-endDate"
												required
												type="datetime-local"
												value={draft.endDate}
												onChange={(event) =>
													setField("endDate", event.target.value)
												}
												aria-invalid={Boolean(fieldErrors.endDate)}
												aria-describedby={
													fieldErrors.endDate
														? "event-error-endDate"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.endDate ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("endDate")}
										</label>
										<label className="text-sm">
											Registration deadline
											<input
												id="event-field-registrationDeadline"
												type="datetime-local"
												value={draft.registrationDeadline ?? ""}
												onChange={(event) =>
													setField(
														"registrationDeadline",
														event.target.value || null,
													)
												}
												aria-invalid={Boolean(fieldErrors.registrationDeadline)}
												aria-describedby={
													fieldErrors.registrationDeadline
														? "event-error-registrationDeadline"
														: undefined
												}
												className={`mt-1 w-full rounded-lg border ${fieldErrors.registrationDeadline ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
											/>
											{fieldIssue("registrationDeadline")}
										</label>
										<div className="grid grid-cols-2 gap-2">
											<label className="text-sm">
												Currency
												<input
													id="event-field-prizeCurrency"
													maxLength={3}
													value={draft.prizeCurrency}
													onChange={(event) =>
														setField(
															"prizeCurrency",
															event.target.value.toUpperCase(),
														)
													}
													aria-invalid={Boolean(fieldErrors.prizeCurrency)}
													aria-describedby={
														fieldErrors.prizeCurrency
															? "event-error-prizeCurrency"
															: undefined
													}
													className={`mt-1 w-full rounded-lg border ${fieldErrors.prizeCurrency ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
												/>
												{fieldIssue("prizeCurrency")}
											</label>
											<label className="text-sm">
												Prize value
												<input
													id="event-field-totalPrizeValue"
													type="number"
													min={0}
													value={draft.totalPrizeValue}
													onChange={(event) =>
														setField(
															"totalPrizeValue",
															Number(event.target.value),
														)
													}
													aria-invalid={Boolean(fieldErrors.totalPrizeValue)}
													aria-describedby={
														fieldErrors.totalPrizeValue
															? "event-error-totalPrizeValue"
															: undefined
													}
													className={`mt-1 w-full rounded-lg border ${fieldErrors.totalPrizeValue ? "border-rose-300/60" : "border-white/10"} bg-black/20 p-2`}
												/>
												{fieldIssue("totalPrizeValue")}
											</label>
										</div>
										<p className="text-xs text-slate-500 sm:col-span-2">
											Use the currency printed on the official event page (for
											example, USD with 5000 for a US$5,000 prize). The amount
											is never converted automatically.
										</p>
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
															<LoaderCircle
																className="animate-spin"
																size={15}
															/>
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
														aria-busy={
															busyAction ===
															(activeTab === "edit" ? "update" : "save")
														}
														className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"
													>
														{busyAction ===
															(activeTab === "edit" ? "update" : "save") && (
															<LoaderCircle
																className="animate-spin"
																size={15}
															/>
														)}
														{busyAction ===
														(activeTab === "edit" ? "update" : "save")
															? "Saving…"
															: activeTab === "edit"
																? "Save event changes"
																: "Save corrections"}
													</button>
													{activeTab === "edit" ? (
														<button
															disabled={busy}
															type="button"
															onClick={() => setActiveTab("approved")}
															className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"
														>
															<X size={15} /> Cancel
														</button>
													) : (
														<button
															disabled={busy}
															type="button"
															onClick={() => void submit("approve")}
															className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"
															aria-busy={busyAction === "approve"}
														>
															{busyAction === "approve" ? (
																<LoaderCircle
																	className="animate-spin"
																	size={15}
																/>
															) : (
																<ShieldCheck size={16} />
															)}
															{busyAction === "approve"
																? "Publishing…"
																: "Approve & publish"}
														</button>
													)}
													<button
														disabled={busy}
														type="button"
														aria-busy={busyAction === "hide"}
														onClick={() => void submit("hide")}
														className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200"
													>
														{busyAction === "hide" && (
															<LoaderCircle
																className="animate-spin"
																size={15}
															/>
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
			{previewEvent && (
				<div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby="event-preview-title"
						className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#151a24] p-6 shadow-2xl"
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
									Published event preview
								</p>
								<h2
									id="event-preview-title"
									className="mt-2 text-2xl font-semibold"
								>
									{previewEvent.title}
								</h2>
								<p className="mt-1 text-sm text-slate-400">
									Organized by {previewEvent.organizer}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setPreviewEvent(null)}
								aria-label="Close event preview"
								className="rounded-lg border border-white/10 p-2 hover:bg-white/5"
							>
								<X size={18} />
							</button>
						</div>
						<div
							role="img"
							aria-label={
								previewEvent.bannerUrl
									? `${previewEvent.title} banner`
									: "DeScience event banner artwork"
							}
							className="mt-5 flex h-36 items-end rounded-xl border border-white/10 bg-cover bg-center p-4"
							style={
								previewEvent.bannerUrl
									? {
											backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.65), transparent), url("${previewEvent.bannerUrl}")`,
										}
									: {
											backgroundImage:
												"radial-gradient(ellipse at top left,rgba(34,211,238,.28),transparent 62%),radial-gradient(ellipse at bottom right,rgba(139,92,246,.22),transparent 60%),linear-gradient(135deg,#1d2730,#181721)",
										}
							}
						>
							<p className="text-lg font-semibold text-white">
								{previewEvent.title}
							</p>
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
								<p className="text-xs text-slate-400">Total prize pool</p>
								<p className="mt-1 text-xl font-semibold text-amber-200">
									{formatPrize(
										previewEvent.prizeCurrency,
										previewEvent.totalPrizeValue,
									)}
								</p>
								<p className="text-xs text-slate-500">
									Currency: {previewEvent.prizeCurrency}
								</p>
							</div>
							<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
								<p className="text-xs text-slate-400">
									Dates · {previewEvent.format.replace("-", " ")}
								</p>
								<p className="mt-1 font-medium">
									{shortDate(previewEvent.startDate)} –{" "}
									{shortDate(previewEvent.endDate)}
								</p>
								<p className="mt-1 text-xs text-slate-400">
									{previewEvent.format === "online"
										? "Online"
										: [previewEvent.venueCity, previewEvent.venueCountry]
												.filter(Boolean)
												.join(", ") || "Location not listed"}
								</p>
							</div>
						</div>
						<div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
							<h3 className="font-semibold">Description</h3>
							<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
								{previewEvent.description ||
									"No description has been added yet."}
							</p>
						</div>
						<a
							href={previewEvent.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-100 px-4 py-2.5 text-sm font-semibold text-slate-950"
						>
							Open official event <ExternalLink size={15} />
						</a>
					</section>
				</div>
			)}
			<SpreadsheetImportDialog
				open={bulkUploadOpen}
				title="Import hackathon events"
				description="Add events to the review queue. They remain unpublished until verified."
				templateHref="/samples/hackathon-bulk-template.csv"
				onClose={() => setBulkUploadOpen(false)}
				onImportFile={uploadBulkEvents}
				instructions={
					<>
						<p>
							<strong className="text-white/80">Required columns:</strong>{" "}
							title, organizer, official_url, start_date, and end_date. Other
							fields can be blank.
						</p>
						<p>
							<strong className="text-white/80">Format:</strong> online,
							in-person, or hybrid. Online / Offline are also accepted.
						</p>
						<p>
							<strong className="text-white/80">Application status:</strong>{" "}
							upcoming, open, closed, or ended. Blank defaults to upcoming.
						</p>
						<p>
							<strong className="text-white/80">Dates:</strong> ISO with
							timezone, or India-style day/month/year and time (for example,
							12/11/2026, 05:30 AM).
						</p>
						<p>
							The downloaded sample is illustrative. Replace or remove the
							sample row before importing. Valid events are saved separately
							from rows with issues.
						</p>
					</>
				}
			/>
		</>
	);
}
