"use client";

import {
	Download,
	Plus,
	Search,
	ShieldCheck,
	UploadCloud,
	UsersRound,
} from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { z } from "zod";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { SpreadsheetImportDialog } from "@/components/admin/SpreadsheetImportDialog";
import {
	type studentMasterAdminRecordSchema,
	studentMasterListSchema,
	studentMasterUploadResultSchema,
	studentMembershipStatusSchema,
} from "@/schemas/admin";

type Student = z.infer<typeof studentMasterAdminRecordSchema>;
type ImportIssue = z.infer<
	typeof studentMasterUploadResultSchema
>["issues"][number];
type ManualStudentDraft = {
	fullName: string;
	email: string;
	batchYear: string;
	collegeName: string;
	department: string;
	degree: string;
	gender: string;
	membershipStatus: "current" | "alumnus" | "mentor" | "guest";
};

const manualFields: Array<
	[keyof Omit<ManualStudentDraft, "membershipStatus">, string, "text" | "email"]
> = [
	["fullName", "Full name", "text"],
	["email", "Email address", "email"],
	["batchYear", "Batch year", "text"],
	["collegeName", "College", "text"],
	["department", "Department", "text"],
	["degree", "Degree", "text"],
	["gender", "Gender", "text"],
];

const emptyManualStudent: ManualStudentDraft = {
	fullName: "",
	email: "",
	batchYear: "",
	collegeName: "",
	department: "",
	degree: "",
	gender: "",
	membershipStatus: "current",
};

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

function downloadIssueRows(issues: ImportIssue[]) {
	const headers = [
		"name",
		"email",
		"batch_year",
		"college",
		"department",
		"degree",
		"gender",
		"membership_status",
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
				issue.values.name,
				issue.values.email,
				issue.values.batch_year,
				issue.values.college,
				issue.values.department,
				issue.values.degree,
				issue.values.gender,
				issue.values.membership_status,
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
	link.download = "student-master-import-issues.csv";
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
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
	const [students, setStudents] = useState<Student[]>([]);
	const [now, setNow] = useState<number | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [studentUploadOpen, setStudentUploadOpen] = useState(false);
	const [savingManual, setSavingManual] = useState(false);
	const [manualOpen, setManualOpen] = useState(false);
	const [manualStudent, setManualStudent] =
		useState<ManualStudentDraft>(emptyManualStudent);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [importIssues, setImportIssues] = useState<ImportIssue[]>([]);
	const [lastImport, setLastImport] = useState<{
		processed: number;
		issueCount: number;
	} | null>(null);

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

	async function importRoster(file: File): Promise<{ summary: string }> {
		setError("");
		setMessage("");
		setImportIssues([]);
		setLastImport(null);
		const form = new FormData();
		form.set("file", file);
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
		setImportIssues(parsed.data.issues);
		setLastImport({
			processed: parsed.data.processed,
			issueCount: parsed.data.issueCount,
		});
		setMessage(
			"Import finished. Valid rows are saved; skipped rows can be corrected and re-uploaded.",
		);
		await refresh();
		return {
			summary: `${parsed.data.processed} records imported or updated; ${parsed.data.issueCount} rows need correction.`,
		};
	}

	async function addStudent(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSavingManual(true);
		setError("");
		setMessage("");
		setImportIssues([]);
		setLastImport(null);
		try {
			const response = await fetch("/api/admin/students", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(manualStudent),
			});
			if (!response.ok) throw new Error(await responseError(response));
			const parsed = studentMasterUploadResultSchema.safeParse(
				await response.json(),
			);
			if (!parsed.success)
				throw new Error("The student record response was invalid.");
			setMessage(
				`${parsed.data.students[0]?.fullName ?? "Student"} was added to the master roster.`,
			);
			setImportIssues([]);
			setLastImport(null);
			setManualStudent(emptyManualStudent);
			setManualOpen(false);
			await refresh();
		} catch (caught: unknown) {
			setError(
				caught instanceof Error
					? caught.message
					: "The student record could not be saved.",
			);
		} finally {
			setSavingManual(false);
		}
	}

	function updateManualStudent<K extends keyof ManualStudentDraft>(
		key: K,
		value: ManualStudentDraft[K],
	) {
		setManualStudent((current) => ({ ...current, [key]: value }));
	}

	return (
		<>
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
									Manage member access and sign-in activity.
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => setManualOpen((open) => !open)}
									aria-expanded={manualOpen}
									className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-cyan-200/30 hover:bg-white/5"
								>
									<Plus size={16} /> Add student
								</button>
								<button
									type="button"
									onClick={() => setStudentUploadOpen(true)}
									className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
								>
									<UploadCloud size={16} /> Bulk upload
								</button>
							</div>
						</div>
						{manualOpen && (
							<form
								onSubmit={(event) => void addStudent(event)}
								className="mt-5 rounded-xl border border-cyan-200/15 bg-black/10 p-4 sm:p-5"
							>
								<div className="mb-4">
									<h3 className="font-semibold">Add a student manually</h3>
									<p className="mt-1 text-xs text-white/45">
										All seven master fields are required. The email address is
										the member’s sign-in identity.
									</p>
								</div>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{manualFields.map(([key, label, type]) => (
										<label
											key={key}
											className="grid gap-1.5 text-xs font-medium text-white/65"
										>
											{label}
											<input
												required
												type={type}
												value={manualStudent[key]}
												onChange={(event) =>
													updateManualStudent(key, event.target.value)
												}
												className="min-h-10 rounded-lg border border-white/10 bg-[#0e1118] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-200/45"
											/>
										</label>
									))}
									<label className="grid gap-1.5 text-xs font-medium text-white/65">
										Membership status
										<select
											value={manualStudent.membershipStatus}
											onChange={(event) => {
												const status = studentMembershipStatusSchema.safeParse(
													event.target.value,
												);
												if (status.success)
													updateManualStudent("membershipStatus", status.data);
											}}
											className="min-h-10 rounded-lg border border-white/10 bg-[#0e1118] px-3 text-sm text-white outline-none focus:border-cyan-200/45"
										>
											<option value="current">Current member</option>
											<option value="alumnus">Alumnus</option>
											<option value="mentor">Mentor</option>
											<option value="guest">Guest (no member access)</option>
										</select>
									</label>
								</div>
								<div className="mt-4 flex justify-end gap-2">
									<button
										type="button"
										onClick={() => setManualOpen(false)}
										disabled={savingManual}
										className="min-h-10 rounded-lg border border-white/10 px-4 text-sm text-white/65 transition hover:bg-white/5 disabled:opacity-50"
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={savingManual}
										aria-busy={savingManual}
										className="min-h-10 rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
									>
										{savingManual ? "Saving student…" : "Save student"}
									</button>
								</div>
							</form>
						)}
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
						{lastImport && (
							<div
								className="mt-4 grid gap-3 sm:grid-cols-2"
								role="status"
								aria-label="Import results"
							>
								<div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3">
									<p className="text-xs font-medium text-emerald-100/65">
										Imported or updated
									</p>
									<p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-100">
										{lastImport.processed}
									</p>
								</div>
								<div
									className={`rounded-xl border px-4 py-3 ${lastImport.issueCount ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-white/10 bg-white/[0.025]"}`}
								>
									<p className="text-xs font-medium text-white/55">
										Rows needing correction
									</p>
									<p
										className={`mt-1 text-2xl font-semibold tabular-nums ${lastImport.issueCount ? "text-amber-100" : "text-white/75"}`}
									>
										{lastImport.issueCount}
									</p>
								</div>
							</div>
						)}
						{importIssues.length > 0 && (
							<section
								aria-label="Rows needing correction"
								className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h3 className="text-sm font-semibold text-amber-100">
											{importIssues.length} rows need attention
										</h3>
										<p className="mt-1 text-xs text-amber-100/65">
											Only these rows were skipped. Download them, correct the
											listed issues, then upload that file.
										</p>
									</div>
									<button
										type="button"
										onClick={() => downloadIssueRows(importIssues)}
										className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-100/20 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-100/10"
									>
										<Download size={14} /> Download issue rows
									</button>
								</div>
								<ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-amber-50/80">
									{importIssues.map((issue) => (
										<li
											key={issue.rowNumber}
											className="rounded-lg bg-black/15 px-3 py-2"
										>
											<span className="font-semibold">
												Row {issue.rowNumber}
											</span>
											<span className="ml-2">
												{issue.values.name ||
													issue.values.email ||
													"Unnamed record"}
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
							</section>
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
																	? new Date(
																			student.lastLoginAt,
																		).toLocaleString()
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
			<SpreadsheetImportDialog
				open={studentUploadOpen}
				title="Import student roster"
				description="Add or update DOS Club members from a spreadsheet."
				templateHref="/samples/student-master-template.csv"
				onClose={() => setStudentUploadOpen(false)}
				onImportFile={importRoster}
				instructions={
					<>
						<p>
							<strong className="text-white/80">Required columns:</strong> name,
							email, batch year, college, department, degree, gender.
						</p>
						<p>
							<strong className="text-white/80">
								Membership status (optional):
							</strong>{" "}
							current, alumnus, mentor, or guest. Blank defaults to current;
							guests cannot sign in.
						</p>
						<p>
							Existing emails are updated. Valid rows import even if other rows
							have issues; you can download and correct only those rows.
						</p>
					</>
				}
			/>
		</>
	);
}
