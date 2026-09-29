"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, Sparkles } from "lucide-react";
import {
	ideaRequestSchema,
	ideaResponseSchema,
	type IdeaRequest,
	type IdeaResponse,
} from "@/schemas/ideator";
import { useWindowManager } from "@/stores/useWindowManager";
import { MarkdownContent } from "@/components/apps/copilot/MarkdownContent";
import { recordFeatureUse } from "@/lib/activity/trackClient";

const FOCUS_OPTIONS = [
	{ value: "open-source", label: "Open Source" },
	{ value: "ai", label: "AI Engineering" },
	{ value: "climate", label: "Climate Tech" },
	{ value: "accessibility", label: "Accessibility" },
	{ value: "student-life", label: "Student Life" },
] as const;

export function ProjectIdeatorApp() {
	const [brief, setBrief] = useState("");
	const [audience, setAudience] = useState("");
	const [focus, setFocus] = useState<IdeaRequest["focus"]>("open-source");
	const [idea, setIdea] = useState("");
	const [provider, setProvider] = useState<IdeaResponse["provider"] | null>(
		null,
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const pendingHackathonIdea = useWindowManager(
		(state) => state.pendingHackathonIdea,
	);
	const setPendingHackathonIdea = useWindowManager(
		(state) => state.setPendingHackathonIdea,
	);

	const requestIdea = useCallback(async (input: IdeaRequest) => {
		setBrief(input.brief);
		setAudience(input.audience ?? "");
		setFocus(input.focus);
		setIdea("");
		setProvider(null);
		setError("");

		setBusy(true);
		try {
			const response = await fetch("/api/ideate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			const payload: unknown = await response.json();
			if (!response.ok) {
				const message =
					typeof payload === "object" &&
					payload !== null &&
					"error" in payload &&
					typeof payload.error === "string"
						? payload.error
						: `Idea request failed with status ${response.status}.`;
				throw new Error(message);
			}
			const result = ideaResponseSchema.safeParse(payload);
			if (!result.success)
				throw new Error(
					"The ideator returned a response in an unexpected format.",
				);
			setIdea(result.data.idea);
			setProvider(result.data.provider);
			recordFeatureUse("project_plan");
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Idea request failed.",
			);
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		if (!pendingHackathonIdea) return;
		setPendingHackathonIdea(null);
		const parsed = ideaRequestSchema.safeParse({
			brief: pendingHackathonIdea,
			audience: "Students participating in this hackathon",
			focus: "open-source",
		});
		if (!parsed.success) {
			setError(
				parsed.error.issues[0]?.message ??
					"The selected hackathon context could not be used.",
			);
			return;
		}
		void requestIdea(parsed.data);
	}, [pendingHackathonIdea, requestIdea, setPendingHackathonIdea]);

	function generateIdea(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = ideaRequestSchema.safeParse({ brief, audience, focus });
		if (!parsed.success) {
			setError(
				parsed.error.issues[0]?.message ??
					"Check the project brief and try again.",
			);
			return;
		}
		void requestIdea(parsed.data);
	}

	return (
		<div className="h-full overflow-auto bg-[#11141c] p-5 text-white sm:p-6">
			<div className="flex items-start gap-3">
				<div className="grid size-10 shrink-0 place-items-center rounded-xl border border-fuchsia-200/20 bg-fuchsia-300/10 text-fuchsia-100">
					<Bot className="size-5" />
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
						PROJECT IDEATOR
					</p>
					<h1 className="mt-1 text-lg font-semibold">
						Start with a useful idea.
					</h1>
					<p className="mt-1 text-xs leading-5 text-white/45">
						Turn a rough problem into a focused, buildable open-source project
						concept.
					</p>
				</div>
			</div>
			<form onSubmit={generateIdea} className="mt-5 space-y-4">
				<div>
					<label
						htmlFor="idea-brief"
						className="mb-1.5 block text-xs font-medium text-white/75"
					>
						What problem would you like to work on?
					</label>
					<textarea
						id="idea-brief"
						required
						minLength={12}
						maxLength={1200}
						value={brief}
						onChange={(event) => setBrief(event.target.value)}
						placeholder="For example: help student clubs make their events easier to discover…"
						className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5 outline-none placeholder:text-white/25 focus:border-fuchsia-200/35"
					/>
					<span className="mt-1 block text-right text-[10px] text-white/30">
						{brief.length}/1200
					</span>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<label
							htmlFor="idea-audience"
							className="mb-1.5 block text-xs font-medium text-white/75"
						>
							Who is it for?
						</label>
						<input
							id="idea-audience"
							maxLength={180}
							value={audience}
							onChange={(event) => setAudience(event.target.value)}
							placeholder="Students, club organizers…"
							className="h-10 w-full rounded-lg border border-white/10 bg-black/15 px-3 text-xs outline-none placeholder:text-white/25 focus:border-fuchsia-200/35"
						/>
					</div>
					<div>
						<label
							htmlFor="idea-focus"
							className="mb-1.5 block text-xs font-medium text-white/75"
						>
							Focus area
						</label>
						<select
							id="idea-focus"
							value={focus}
							onChange={(event) => {
								const option = FOCUS_OPTIONS.find(
									(item) => item.value === event.target.value,
								);
								if (option) setFocus(option.value);
							}}
							className="h-10 w-full rounded-lg border border-white/10 bg-[#171a23] px-3 text-xs text-white/80 outline-none focus:border-fuchsia-200/35"
						>
							{FOCUS_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
				</div>
				<button
					type="submit"
					disabled={busy}
					className="inline-flex h-10 items-center gap-2 rounded-lg bg-fuchsia-200 px-4 text-xs font-semibold text-[#211026] transition hover:bg-fuchsia-100 disabled:cursor-wait disabled:opacity-60"
				>
					{busy ? (
						<LoaderCircle className="size-3.5 animate-spin" />
					) : (
						<Sparkles className="size-3.5" />
					)}
					{busy ? "Thinking…" : "Generate a project concept"}
				</button>
			</form>
			{error && (
				<p
					role="alert"
					className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-200"
				>
					{error}
				</p>
			)}
			{idea && (
				<section
					aria-label="Generated project idea"
					className="mt-5 rounded-xl border border-fuchsia-200/15 bg-fuchsia-200/[0.035] p-4"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-fuchsia-100">
							Your concept
						</h2>
						<span className="text-[10px] text-white/35">
							Fresh result ·{" "}
							{provider === "jarvislabs" ? "Ollama · JarvisLabs" : ""}
						</span>
					</div>
					<div className="mt-3 text-xs leading-6 text-white/75">
						<MarkdownContent content={idea} />
					</div>
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard.writeText(idea);
						}}
						className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-white/60 hover:text-white"
					>
						Copy concept
					</button>
				</section>
			)}
			<p className="mt-5 text-[10px] leading-4 text-white/30">
				Each request generates a fresh idea with the development Ollama model
				hosted by JarvisLabs. Don’t include secrets or personal data. Successful
				project-planning uses are counted for club analytics; prompts and
				results are not included in that log.
			</p>
		</div>
	);
}
