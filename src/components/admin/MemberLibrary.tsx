"use client";

import {
	AlertTriangle,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	FileText,
	LoaderCircle,
	RefreshCw,
	ShieldCheck,
	Trash2,
	UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import {
	type MemberLibraryFile,
	memberLibraryListSchema,
	memberLibraryUploadResultSchema,
} from "@/schemas/admin";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".xlsx,.xls,.csv,.txt,.md,.json";

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoDate: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(isoDate));
}

async function responseError(response: Response): Promise<string> {
	const body: unknown = await response.json().catch(() => null);
	if (
		typeof body === "object" &&
		body !== null &&
		"error" in body &&
		typeof body.error === "string"
	) {
		return body.error;
	}
	return `Request failed (${response.status}).`;
}

export function MemberLibrary() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [files, setFiles] = useState<MemberLibraryFile[]>([]);
	const [collegeName, setCollegeName] = useState("");
	const [allowAi, setAllowAi] = useState(false);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/library", {
				cache: "no-store",
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = memberLibraryListSchema.safeParse(await response.json());
			if (!parsed.success) throw new Error("The library response was invalid.");
			setFiles(parsed.data.files);
		} catch (caught: unknown) {
			setError(
				caught instanceof Error
					? caught.message
					: "Unable to load the member library.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const uploadSelectedFiles = async (selectedFiles: FileList | null) => {
		if (!selectedFiles || selectedFiles.length === 0) return;
		setUploading(true);
		setError(null);
		setMessage(null);
		let uploaded = 0;
		for (const file of Array.from(selectedFiles)) {
			if (file.size > MAX_FILE_BYTES) {
				setError(`${file.name}: files must be 10 MB or smaller.`);
				continue;
			}
			const formData = new FormData();
			formData.set("file", file);
			formData.set("aiEnabled", String(allowAi));
			formData.set("collegeName", collegeName.trim());
			try {
				const response = await fetch("/api/admin/library", {
					method: "POST",
					body: formData,
				});
				if (!response.ok) throw new Error(await responseError(response));
				const parsed = memberLibraryUploadResultSchema.safeParse(
					await response.json(),
				);
				if (!parsed.success)
					throw new Error("The upload response was invalid.");
				uploaded += 1;
			} catch (caught: unknown) {
				setError(
					`${file.name}: ${caught instanceof Error ? caught.message : "Upload failed."}`,
				);
			}
		}
		setUploading(false);
		if (uploaded > 0) {
			setMessage(
				`${uploaded} ${uploaded === 1 ? "file was" : "files were"} stored and indexed for authorized Ollama retrieval. Student roster records are managed separately in Students.`,
			);
			await refresh();
		}
		if (inputRef.current) inputRef.current.value = "";
	};

	const deleteFile = async (file: MemberLibraryFile) => {
		if (
			!window.confirm(`Remove “${file.originalFilename}” and its indexed text?`)
		) {
			return;
		}
		setError(null);
		setMessage(null);
		setDeletingId(file.id);
		try {
			const response = await fetch("/api/admin/library", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: file.id }),
			});
			if (!response.ok) throw new Error(await responseError(response));
			setFiles((current) => current.filter((item) => item.id !== file.id));
			setMessage("File and indexed content removed.");
		} catch (caught: unknown) {
			setError(
				caught instanceof Error
					? caught.message
					: "Unable to delete this file.",
			);
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<main className="os-standalone-screen admin-dashboard min-h-dvh bg-[#0e1118] px-4 py-6 text-white sm:px-8 sm:py-10">
			<AdminNavigation active="library" />
			<div className="mx-auto max-w-7xl lg:ml-[17rem]">
				<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
							DeScience OS · Admin
						</p>
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							Member Knowledge Library
						</h1>
						<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
							Keep member sign-up details, skills, project history, hackathon
							results, and assessment reports together. Uploaded spreadsheets
							and text are searchable for authorized member suggestions.
						</p>
					</div>
				</header>

				<section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-7">
					<div className="mb-5 flex items-start gap-3">
						<div className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-200">
							<UploadCloud size={22} aria-hidden="true" />
						</div>
						<div>
							<h2 className="text-lg font-semibold">
								Add files to the library
							</h2>
							<p className="mt-1 text-sm text-slate-400">
								Store skill, DISC/agile, project, and performance reference
								files for approved Ollama-assisted team suggestions. Originals
								remain in private storage.
							</p>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
						<label className="block text-sm text-slate-300">
							College label <span className="text-slate-500">(optional)</span>
							<input
								value={collegeName}
								onChange={(event) => setCollegeName(event.target.value)}
								maxLength={180}
								placeholder="e.g. Anna University"
								className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
							/>
						</label>
						<div className="flex items-end">
							<label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
								<input
									type="checkbox"
									checked={allowAi}
									onChange={(event) => setAllowAi(event.target.checked)}
									className="mt-0.5 accent-emerald-300"
								/>
								<span>
									<strong className="font-medium text-slate-100">
										Allow Ollama suggestions
									</strong>
									<span className="mt-1 block text-xs leading-5 text-slate-500">
										Relevant excerpts may be sent to hosted JarvisLabs Ollama.
										Remove direct identifiers and confirm you have permission
										first.
									</span>
								</span>
							</label>
						</div>
					</div>
					<p className="mt-4 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.04] p-3 text-xs leading-5 text-slate-300">
						This library does not create or update student master records.
						Upload roster fields under Students. For member-specific reference
						rows, include the member email so retrieved excerpts can be linked
						to a roster record. Assessment content is indexed only when consent
						is present and Ollama access is explicitly enabled.
					</p>

					<div className="mt-5 flex flex-wrap items-center gap-3">
						<input
							ref={inputRef}
							aria-label="Choose library files"
							className="sr-only"
							accept={ACCEPTED_TYPES}
							multiple
							type="file"
							disabled={uploading}
							onChange={(event) => void uploadSelectedFiles(event.target.files)}
						/>
						<button
							type="button"
							disabled={uploading}
							aria-busy={uploading}
							onClick={() => inputRef.current?.click()}
							className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60"
						>
							{uploading ? (
								<LoaderCircle className="animate-spin" size={17} />
							) : (
								<UploadCloud size={17} />
							)}
							{uploading ? "Uploading and indexing…" : "Choose files"}
						</button>
						<a
							href="/samples/member-master-sample.csv"
							download
							className="text-xs text-cyan-200 underline decoration-cyan-200/30 underline-offset-4 hover:text-white"
						>
							Download synthetic sample CSV
						</a>
						<span className="text-xs text-slate-500">
							Excel, CSV, TXT, Markdown, JSON · up to 10 MB each
						</span>
					</div>

					<div className="mt-5 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">
						<AlertTriangle
							className="mt-0.5 shrink-0 text-amber-200"
							size={16}
						/>
						<p>
							Assessment reports and student records are private. Keep AI access
							off until the relevant members have agreed to their information
							being used by the hosted model. Raw uploads are never sent as
							files; only retrieved text excerpts can be used.
						</p>
					</div>
					{error ? (
						<p role="alert" className="mt-4 text-sm text-rose-300">
							{error}
						</p>
					) : null}
					{message ? (
						<p role="status" className="mt-4 text-sm text-emerald-200">
							{message}
						</p>
					) : null}
				</section>

				<section className="mt-8">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Stored files</h2>
							<p className="mt-1 text-sm text-slate-500">
								Private originals with searchable extracted text.
							</p>
						</div>
						<button
							type="button"
							aria-label="Refresh file list"
							onClick={() => void refresh()}
							className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
						>
							<RefreshCw className={loading ? "animate-spin" : ""} size={16} />
						</button>
					</div>
					{loading ? (
						<AdminSkeleton kind="library" />
					) : files.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
							No files yet. Add a workbook, CSV, or notes file to start building
							the searchable member library.
						</div>
					) : (
						<ul className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
							{files.map((file) => (
								<li
									key={file.id}
									className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"
								>
									<div className="flex min-w-0 items-start gap-3">
										<div className="mt-0.5 rounded-lg bg-white/5 p-2 text-slate-300">
											{file.contentType.includes("spreadsheet") ||
											file.contentType === "text/csv" ? (
												<FileSpreadsheet size={18} />
											) : (
												<FileText size={18} />
											)}
										</div>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-slate-100">
												{file.originalFilename}
											</p>
											<p className="mt-1 text-xs text-slate-500">
												{formatBytes(file.fileSize)} · {file.chunkCount} indexed
												rows
												{file.collegeName ? ` · ${file.collegeName}` : ""} ·{" "}
												{formatDate(file.createdAt)}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span
											className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${file.aiEnabled ? "bg-emerald-300/10 text-emerald-200" : "bg-white/5 text-slate-400"}`}
										>
											{file.aiEnabled ? (
												<CheckCircle2 size={13} />
											) : (
												<ShieldCheck size={13} />
											)}
											{file.aiEnabled ? "AI enabled" : "Private"}
										</span>
										<a
											href={`/api/admin/library/${file.id}/download`}
											aria-label={`Download ${file.originalFilename}`}
											className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
										>
											<Download size={16} />
										</a>
										<button
											type="button"
											aria-label={`Delete ${file.originalFilename}`}
											disabled={deletingId === file.id}
											aria-busy={deletingId === file.id}
											onClick={() => void deleteFile(file)}
											className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300"
										>
											{deletingId === file.id ? (
												<LoaderCircle className="animate-spin" size={16} />
											) : (
												<Trash2 size={16} />
											)}
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</main>
	);
}
