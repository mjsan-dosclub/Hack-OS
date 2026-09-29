"use client";

import { Search, ShieldCheck, UploadCloud, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import {
	type studentMasterAdminRecordSchema,
	studentMasterListSchema,
	studentMasterUploadResultSchema,
} from "@/schemas/admin";

type Student = z.infer<typeof studentMasterAdminRecordSchema>;

function relativeLogin(value: string | null, now: number): string {
	if (!value) return "Never";
	const elapsed = Math.max(0, now - new Date(value).getTime());
	if (elapsed < 45_000) return "A few seconds ago";
	const minutes = Math.floor(elapsed / 60_000);
	if (minutes < 60)
		return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
	const years = Math.floor(months / 12);
	return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function hasRequiredMasterFields(student: Student): boolean {
	return Boolean(
		student.fullName.trim() &&
			student.email.trim() &&
			student.batchYear?.trim() &&
			student.collegeName?.trim() &&
			student.department?.trim() &&
			student.degree?.trim() &&
			student.gender?.trim(),
	);
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
	return `Roster request failed (${response.status}).`;
}

export function StudentMaster() {
	const fileRef = useRef<HTMLInputElement>(null);
	const [students, setStudents] = useState<Student[]>([]);
	const [now, setNow] = useState<number | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/admin/students", {
				cache: "no-store",
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = studentMasterListSchema.safeParse(await response.json());
			if (!parsed.success)
				throw new Error("The student roster response was invalid.");
			setStudents(parsed.data.students);
			setError("");
		} catch (caught: unknown) {
			setError(
				caught instanceof Error
					? caught.message
					: "Student roster is unavailable.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);

	const filteredStudents = useMemo(() => {
		const needle = search.trim().toLowerCase();
		if (!needle) return students;
		return students.filter((student) =>
			[
				student.fullName,
				student.email,
				student.batchYear,
				student.collegeName,
				student.department,
				student.degree,
			].some((value) => value?.toLowerCase().includes(needle)),
		);
	}, [search, students]);

	const completeCount = students.filter(hasRequiredMasterFields).length;
	const neverLoggedIn = students.filter(
		(student) => !student.lastLoginAt,
	).length;

	async function uploadRoster(file: File | undefined) {
		if (!file) return;
		setUploading(true);
		setError("");
		setMessage("");
		const form = new FormData();
		form.set("file", file);
		try {
			const response = await fetch("/api/admin/students", {
				method: "POST",
				body: form,
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = studentMasterUploadResultSchema.safeParse(
				await response.json(),
			);
			if (!parsed.success)
				throw new Error("The roster import response was invalid.");
			setMessage(
				`${parsed.data.processed} student records added or updated. These records can request a sign-in code once all required master fields are complete.`,
			);
			await refresh();
		} catch (caught: unknown) {
			setError(
				caught instanceof Error ? caught.message : "The roster upload failed.",
			);
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	return (
		<main className="os-standalone-screen admin-dashboard min-h-dvh bg-[#0e1118] px-4 py-6 text-white sm:px-8 sm:py-10">
			<AdminNavigation active="students" />
			<div className="mx-auto max-w-7xl lg:ml-[17rem]">
				<header className="mb-7 flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
							<UsersRound size={15} /> Member operations
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight">
							Student master
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
							The approved roster controls member sign-in. Import the core
							student record here; upload skills and assessment material
							separately to the Ollama library.
						</p>
					</div>
				</header>

				<section
					className="mb-5 grid gap-3 sm:grid-cols-3"
					aria-label="Roster summary"
				>
					<article className="rounded-2xl border border-white/10 bg-[#151a24] p-4">
						<p className="text-xs text-white/50">Master records</p>
						<p className="mt-2 text-2xl font-semibold tabular-nums">
							{loading ? "—" : students.length}
						</p>
					</article>
					<article className="rounded-2xl border border-white/10 bg-[#151a24] p-4">
						<p className="flex items-center gap-2 text-xs text-white/50">
							<ShieldCheck size={14} /> Complete for sign-in
						</p>
						<p className="mt-2 text-2xl font-semibold tabular-nums">
							{loading ? "—" : completeCount}
						</p>
					</article>
					<article className="rounded-2xl border border-white/10 bg-[#151a24] p-4">
						<p className="text-xs text-white/50">Never signed in</p>
						<p className="mt-2 text-2xl font-semibold tabular-nums">
							{loading ? "—" : neverLoggedIn}
						</p>
					</article>
				</section>

				<section className="rounded-2xl border border-white/10 bg-[#151a24] p-4 shadow-xl shadow-black/10 sm:p-5">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h2 className="font-semibold">Member roster</h2>
							<p className="mt-1 text-xs text-white/45">
								Required columns: name, email, batch year, college, department,
								degree, gender.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<a
								href="/samples/student-master-template.csv"
								download
								className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:bg-white/5"
							>
								Download template
							</a>
							<input
								ref={fileRef}
								type="file"
								accept=".xlsx,.xls,.csv"
								className="sr-only"
								aria-label="Select student master workbook"
								disabled={uploading}
								onChange={(event) => void uploadRoster(event.target.files?.[0])}
							/>
							<button
								type="button"
								onClick={() => fileRef.current?.click()}
								disabled={uploading}
								aria-busy={uploading}
								className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
							>
								<UploadCloud size={16} />{" "}
								{uploading ? "Importing roster…" : "Bulk upload"}
							</button>
						</div>
					</div>
					{error && (
						<p
							role="alert"
							className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200"
						>
							{error}
						</p>
					)}
					{message && (
						<p
							role="status"
							className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-200"
						>
							{message}
						</p>
					)}
					<div className="relative mt-5 max-w-lg">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
							size={16}
							aria-hidden="true"
						/>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search name, email, college, department…"
							aria-label="Search student master"
							className="w-full rounded-xl border border-white/10 bg-black/15 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-white/30 focus:border-cyan-200/40"
						/>
					</div>
					{loading ? (
						<AdminSkeleton kind="students" />
					) : (
						<div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
							<table className="w-full min-w-[1050px] border-collapse text-left text-sm">
								<thead className="bg-white/[0.035] text-xs uppercase tracking-wide text-white/45">
									<tr>
										<th className="px-4 py-3">Student</th>
										<th className="px-4 py-3">College</th>
										<th className="px-4 py-3">Department / degree</th>
										<th className="px-4 py-3">Batch</th>
										<th className="px-4 py-3">Access</th>
										<th className="px-4 py-3">Last login</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/[0.07]">
									{filteredStudents.map((student) => {
										const complete =
											hasRequiredMasterFields(student) &&
											student.verifiedMember &&
											student.membershipStatus !== "guest";
										return (
											<tr
												key={student.id}
												className="transition hover:bg-white/[0.025]"
											>
												<td className="px-4 py-3">
													<p className="font-medium text-white/90">
														{student.fullName}
													</p>
													<p className="mt-1 text-xs text-white/45">
														{student.email}
													</p>
												</td>
												<td className="px-4 py-3 text-white/75">
													{student.collegeName ?? "—"}
												</td>
												<td className="px-4 py-3">
													<p className="text-white/75">
														{student.department ?? "Missing department"}
													</p>
													<p className="mt-1 text-xs text-white/45">
														{student.degree ?? "Missing degree"} ·{" "}
														{student.gender ?? "Missing gender"}
													</p>
												</td>
												<td className="px-4 py-3 text-white/70">
													{student.batchYear ?? "Missing batch"}
												</td>
												<td className="px-4 py-3">
													<span
														className={`rounded-full px-2.5 py-1 text-xs font-medium ${complete ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}
													>
														{complete
															? student.membershipStatus
															: "Incomplete roster"}
													</span>
												</td>
												<td className="px-4 py-3">
													<time
														dateTime={student.lastLoginAt ?? undefined}
														title={
															student.lastLoginAt
																? new Date(student.lastLoginAt).toLocaleString()
																: undefined
														}
														className={`whitespace-nowrap text-xs ${student.lastLoginAt ? "text-white/65" : "text-white/35"}`}
													>
														{now === null
															? "—"
															: relativeLogin(student.lastLoginAt, now)}
													</time>
												</td>
											</tr>
										);
									})}
									{filteredStudents.length === 0 && (
										<tr>
											<td
												colSpan={6}
												className="px-4 py-12 text-center text-sm text-white/40"
											>
												{students.length
													? "No students match this search."
													: "The roster is empty. Upload a student master workbook to grant approved members access."}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
