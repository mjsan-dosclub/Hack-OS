"use client";

import {
	CheckCircle2,
	Download,
	FileSpreadsheet,
	LoaderCircle,
	UploadCloud,
	X,
} from "lucide-react";
import {
	type DragEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import * as XLSX from "xlsx";

type ImportOutcome = { summary: string };
type ImportPhase = "idle" | "reading" | "importing" | "complete";

type SpreadsheetImportDialogProps = {
	open: boolean;
	title: string;
	description: string;
	templateHref: string;
	instructions: ReactNode;
	onClose: () => void;
	onImportFile: (file: File) => Promise<ImportOutcome>;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function SpreadsheetImportDialog({
	open,
	title,
	description,
	templateHref,
	instructions,
	onClose,
	onImportFile,
}: SpreadsheetImportDialogProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [phase, setPhase] = useState<ImportPhase>("idle");
	const [file, setFile] = useState<File | null>(null);
	const [recordCount, setRecordCount] = useState<number | null>(null);
	const [dragging, setDragging] = useState(false);
	const [localError, setLocalError] = useState("");
	const [summary, setSummary] = useState("");
	const busy = phase === "reading" || phase === "importing";

	useEffect(() => {
		if (!open) return;
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && !busy) onClose();
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [busy, onClose, open]);

	useEffect(() => {
		if (!open) {
			setPhase("idle");
			setFile(null);
			setRecordCount(null);
			setLocalError("");
			setSummary("");
		}
	}, [open]);

	if (!open) return null;

	async function chooseFile(nextFile: File | undefined) {
		if (!nextFile) return;
		setLocalError("");
		setSummary("");
		setFile(null);
		setRecordCount(null);
		if (!/\.(xlsx|xls|csv)$/i.test(nextFile.name)) {
			setLocalError("Choose an Excel workbook (.xlsx or .xls) or a CSV file.");
			return;
		}
		if (nextFile.size === 0 || nextFile.size > MAX_FILE_BYTES) {
			setLocalError("Choose a non-empty file no larger than 10 MB.");
			return;
		}
		setPhase("reading");
		try {
			const workbook = XLSX.read(await nextFile.arrayBuffer(), {
				type: "array",
				raw: false,
				cellDates: false,
			});
			const firstSheetName = workbook.SheetNames[0];
			const firstSheet = firstSheetName
				? workbook.Sheets[firstSheetName]
				: undefined;
			if (!firstSheet)
				throw new Error("This workbook has no readable worksheet.");
			const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
				firstSheet,
				{
					defval: "",
					raw: false,
					blankrows: false,
				},
			);
			const count = rows.filter((row) =>
				Object.values(row).some((value) => String(value).trim().length > 0),
			).length;
			if (count === 0)
				throw new Error("No data rows were found below the header row.");
			setFile(nextFile);
			setRecordCount(count);
			setPhase("idle");
		} catch (caught: unknown) {
			setPhase("idle");
			setLocalError(
				caught instanceof Error
					? caught.message
					: "The selected spreadsheet could not be read.",
			);
		} finally {
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function importFile() {
		if (!file) return;
		setPhase("importing");
		setLocalError("");
		try {
			const outcome = await onImportFile(file);
			setSummary(outcome.summary);
			setPhase("complete");
		} catch (caught: unknown) {
			setPhase("idle");
			setLocalError(
				caught instanceof Error
					? caught.message
					: "The import could not be completed.",
			);
		}
	}

	function handleDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		setDragging(false);
		void chooseFile(event.dataTransfer.files[0]);
	}

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
			role="presentation"
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="spreadsheet-import-title"
				className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#151a24] shadow-2xl shadow-black/50"
			>
				<header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
					<div className="flex items-start gap-3">
						<span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.08] text-cyan-100">
							<FileSpreadsheet size={19} />
						</span>
						<div>
							<h2
								id="spreadsheet-import-title"
								className="text-lg font-semibold text-white"
							>
								{title}
							</h2>
							<p className="mt-1 text-sm text-white/55">{description}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						aria-label="Close import dialog"
						className="rounded-lg p-2 text-white/55 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
					>
						<X size={18} />
					</button>
				</header>

				<div className="space-y-5 p-5 sm:p-6">
					<input
						ref={inputRef}
						type="file"
						accept=".xlsx,.xls,.csv"
						className="sr-only"
						aria-label="Browse for a spreadsheet"
						disabled={busy}
						onChange={(event) => void chooseFile(event.target.files?.[0])}
					/>
					<button
						type="button"
						disabled={busy}
						onClick={() => inputRef.current?.click()}
						onDragOver={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={handleDrop}
						className={`flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? "border-cyan-200 bg-cyan-200/[0.08]" : "border-white/15 bg-black/10 hover:border-cyan-200/35 hover:bg-white/[0.025]"} disabled:cursor-wait disabled:opacity-70`}
					>
						<span className="mb-3 grid size-12 place-items-center rounded-xl bg-cyan-200/10 text-cyan-100">
							{phase === "reading" ? (
								<LoaderCircle className="animate-spin" size={23} />
							) : (
								<UploadCloud size={24} />
							)}
						</span>
						<span className="text-sm font-semibold text-white">
							{phase === "reading"
								? "Reading spreadsheet…"
								: file
									? file.name
									: "Drop your file here or browse"}
						</span>
						<span className="mt-1 text-xs text-white/45">
							Excel or CSV · up to 10 MB
						</span>
						{recordCount !== null && phase !== "complete" && (
							<span className="mt-3 rounded-full border border-cyan-200/15 bg-cyan-200/[0.07] px-3 py-1 text-xs font-medium text-cyan-100">
								{recordCount} {recordCount === 1 ? "record" : "records"} read
							</span>
						)}
					</button>

					{phase === "importing" && (
						<div
							className="rounded-xl border border-cyan-200/15 bg-cyan-200/[0.05] p-4"
							role="status"
							aria-live="polite"
						>
							<div className="flex items-center gap-3">
								<LoaderCircle
									className="animate-spin text-cyan-100"
									size={20}
								/>
								<div>
									<p className="text-sm font-semibold text-white">
										Importing {recordCount}{" "}
										{recordCount === 1 ? "record" : "records"}…
									</p>
									<p className="mt-0.5 text-xs text-white/50">
										Validating each row and saving accepted records.
									</p>
								</div>
							</div>
							<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
								<div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-200" />
							</div>
						</div>
					)}

					{phase === "complete" && (
						<div
							className="flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4"
							role="status"
							aria-live="polite"
						>
							<CheckCircle2
								className="mt-0.5 shrink-0 text-emerald-200"
								size={19}
							/>
							<div>
								<p className="text-sm font-semibold text-emerald-100">
									Import finished
								</p>
								<p className="mt-1 text-sm text-emerald-100/75">{summary}</p>
							</div>
						</div>
					)}

					{localError && (
						<p
							role="alert"
							className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100"
						>
							{localError}
						</p>
					)}

					<div className="rounded-xl border border-white/10 bg-black/10 p-4">
						<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
							<h3 className="text-sm font-semibold text-white">
								Before you import
							</h3>
							<a
								href={templateHref}
								download
								className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/5 hover:text-white"
							>
								<Download size={14} /> Download sample format
							</a>
						</div>
						<div className="space-y-2 text-xs leading-5 text-white/55">
							{instructions}
						</div>
					</div>

					<footer className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-xs text-white/40">
							Successful rows are saved even when other rows need correction.
						</p>
						<div className="flex items-center gap-2">
							{phase === "complete" ? (
								<button
									type="button"
									onClick={onClose}
									className="min-h-10 rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
								>
									Done
								</button>
							) : (
								<>
									<button
										type="button"
										onClick={onClose}
										disabled={busy}
										className="min-h-10 rounded-lg border border-white/10 px-4 text-sm text-white/65 transition hover:bg-white/5 disabled:opacity-40"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={() => void importFile()}
										disabled={!file || busy}
										aria-busy={phase === "importing"}
										className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{phase === "importing" ? (
											<LoaderCircle className="animate-spin" size={16} />
										) : (
											<UploadCloud size={16} />
										)}
										{phase === "importing" ? "Importing…" : "Import records"}
									</button>
								</>
							)}
						</div>
					</footer>
				</div>
			</section>
		</div>
	);
}
