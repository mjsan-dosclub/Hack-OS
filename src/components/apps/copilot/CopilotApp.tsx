"use client";

import {
	Bot,
	Check,
	ChevronDown,
	CircleStop,
	LoaderCircle,
	Send,
	Sparkles,
	Target,
	Users,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownContent } from "@/components/apps/copilot/MarkdownContent";
import { SpecViewer } from "@/components/apps/copilot/SpecViewer";
import {
	TEAM_HOUR_OPTIONS,
	TEAM_SKILL_OPTIONS,
	useCopilotContext,
} from "@/hooks/useCopilotContext";
import { recordFeatureUse } from "@/lib/activity/trackClient";
import { QUICK_PROMPTS } from "@/lib/copilot/prompts";
import {
	type CopilotMessage,
	type CopilotMode,
	copilotChatRequestSchema,
	type IdeaEvaluation,
	ideaEvaluationRequestSchema,
	ideaEvaluationSchema,
} from "@/schemas/copilot";
import { useWindowManager } from "@/stores/useWindowManager";

const MODES: readonly { id: CopilotMode; label: string }[] = [
	{ id: "brainstorm", label: "Brainstorm Ideas" },
	{ id: "architecture", label: "Architecture & Spec" },
	{ id: "evaluate", label: "Idea Evaluator" },
	{ id: "sprint", label: "Sprint Planner" },
];

interface ChatRow extends CopilotMessage {
	id: string;
	evaluation?: IdeaEvaluation;
	responseSeconds?: number;
}

const WAITING_GUIDANCE = [
	"Write the problem in one sentence. If the team cannot agree on it, pause before choosing technology.",
	"Choose one small user journey you can demonstrate end to end. A finished slice teaches more than five unfinished features.",
	"Split ownership across problem research, building, testing, and the pitch. Roles can overlap, but every task needs an owner.",
	"Read the official judging criteria and connect each requirement to something judges can see in your demo.",
	"Keep time for testing and a rehearsal. Explain the problem, show the working part, then share what you learned.",
	"A certificate is a record of participation. Your strongest outcome is a skill, useful feedback, and a project you can explain honestly.",
] as const;

function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

const fieldClass =
	"h-8 w-full rounded-lg border border-white/10 bg-[#10131b] px-2.5 text-[10px] text-white/80 outline-none focus:border-cyan-100/35";

function EvaluationCard({ result }: { result: IdeaEvaluation }) {
	const rows = [
		{ label: "Originality", ...result.breakdown.originality },
		{ label: "Track fit", ...result.breakdown.trackRelevance },
		{ label: "Feasibility", ...result.breakdown.technicalFeasibility },
		{ label: "Demo impact", ...result.breakdown.demoImpact },
	];
	return (
		<section
			className="mt-3 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.035] p-3"
			aria-label="Structured idea evaluation"
		>
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold text-cyan-50">
					Feasibility score
				</h3>
				<span className="font-mono text-lg font-bold text-cyan-100">
					{result.overallScore}
					<span className="text-[10px] text-white/35">/100</span>
				</span>
			</div>
			<div className="mt-3 grid gap-2 sm:grid-cols-2">
				{rows.map((row) => (
					<div
						key={row.label}
						className="rounded-lg border border-white/[0.07] bg-black/15 p-2.5"
					>
						<div className="flex justify-between text-[10px] text-white/70">
							<span>{row.label}</span>
							<span className="font-mono text-cyan-100">{row.score}/10</span>
						</div>
						<p className="mt-1 text-[10px] leading-4 text-white/45">
							{"rationale" in row
								? row.rationale
								: "pitchAdvice" in row
									? row.pitchAdvice
									: row.bottleneckRisks.join("; ")}
						</p>
					</div>
				))}
			</div>
			<p className="mt-3 text-[10px] text-white/55">
				<strong className="text-white/75">Track considered:</strong>{" "}
				{result.breakdown.trackRelevance.matchedTrack}
			</p>
			{result.strengths.length > 0 && (
				<div className="mt-3">
					<h4 className="text-[10px] font-semibold text-emerald-100">
						Strengths
					</h4>
					<ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] leading-4 text-white/55">
						{[...new Set(result.strengths)].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			)}
			{result.criticalWeaknesses.length > 0 && (
				<div className="mt-3">
					<h4 className="text-[10px] font-semibold text-amber-100">
						Risks to address
					</h4>
					<ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] leading-4 text-white/55">
						{[...new Set(result.criticalWeaknesses)].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			)}
			{result.pivotSuggestions.length > 0 && (
				<div className="mt-3">
					<h4 className="text-[10px] font-semibold text-cyan-100">
						Practical pivots
					</h4>
					<ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] leading-4 text-white/55">
						{[...new Set(result.pivotSuggestions)].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

/** Student-facing AI workspace grounded in a schema-validated selected event and team profile. */
export function CopilotApp() {
	const { hackathon, eventDurationDays, team, setTeam, toggleSkill } =
		useCopilotContext();
	const openRadar = useWindowManager((state) => state.openWindow);
	const [mode, setMode] = useState<CopilotMode>("brainstorm");
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatRow[]>([]);
	const [busy, setBusy] = useState(false);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [error, setError] = useState("");
	const [streamingText, setStreamingText] = useState("");
	const [latestAssistant, setLatestAssistant] = useState("");
	const [pitchDraft, setPitchDraft] = useState("");
	const [copiedPitch, setCopiedPitch] = useState(false);
	const transcriptRef = useRef<HTMLDivElement>(null);
	const messageInputRef = useRef<HTMLTextAreaElement>(null);
	const pitchInputRef = useRef<HTMLTextAreaElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const requestStartedAtRef = useRef<number | null>(null);
	const activeWindowId = useWindowManager((state) => state.activeWindowId);

	useEffect(() => {
		if (activeWindowId !== "copilot") return;
		const frame = window.requestAnimationFrame(() => {
			const input =
				mode === "evaluate" ? pitchInputRef.current : messageInputRef.current;
			input?.focus();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [activeWindowId, mode]);

	useEffect(() => {
		if (!busy) return;
		const timer = window.setInterval(() => {
			const startedAt = requestStartedAtRef.current;
			if (startedAt !== null)
				setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [busy]);

	useEffect(() => {
		if (messages.length === 0 && !streamingText && !busy) return;
		transcriptRef.current?.scrollTo({
			top: transcriptRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages.length, streamingText, busy]);

	useEffect(() => () => abortRef.current?.abort(), []);

	const hackathonSummary = useMemo(() => {
		if (!hackathon)
			return "Select an event from Radar to ground ideas in its published tracks and rules.";
		return `${hackathon.format === "online" ? "Online" : [hackathon.venueCity, hackathon.venueCountry].filter(Boolean).join(", ") || "Location not listed"} · ${eventDurationDays ?? 1} day${eventDurationDays === 1 ? "" : "s"} · ${hackathon.tracks.length} listed track${hackathon.tracks.length === 1 ? "" : "s"}`;
	}, [eventDurationDays, hackathon]);

	async function submitMessage(
		rawText: string,
		modeOverride?: CopilotMode,
	): Promise<void> {
		const text = rawText.trim();
		if (!text || busy) return;
		const activeMode = modeOverride ?? mode;
		setInput("");
		setPitchDraft(activeMode === "evaluate" ? text : pitchDraft);
		setError("");
		setStreamingText("");
		const userMessage: ChatRow = {
			id: crypto.randomUUID(),
			role: "user",
			content: text,
		};
		const priorMessages = messages.map(({ role, content }) => ({
			role,
			content,
		}));
		const visibleHistory = [
			...priorMessages,
			{ role: "user" as const, content: text },
		].slice(-8);
		setMessages((current) => [...current, userMessage]);
		const requestStartedAt = Date.now();
		requestStartedAtRef.current = requestStartedAt;
		setElapsedSeconds(0);
		setBusy(true);

		const controller = new AbortController();
		abortRef.current = controller;
		try {
			if (activeMode === "evaluate") {
				const request = ideaEvaluationRequestSchema.safeParse({
					pitch: text,
					context: hackathon,
					team,
				});
				if (!request.success)
					throw new Error(
						request.error.issues[0]?.message ??
							"Add a more detailed project pitch to evaluate.",
					);
				const response = await fetch("/api/copilot/evaluate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(request.data),
					signal: controller.signal,
				});
				const payload: unknown = await response.json();
				if (!response.ok) {
					const message =
						typeof payload === "object" &&
						payload !== null &&
						"error" in payload &&
						typeof payload.error === "string"
							? payload.error
							: "The evaluator request failed.";
					throw new Error(message);
				}
				const parsed = ideaEvaluationSchema.safeParse(payload);
				if (!parsed.success)
					throw new Error(
						"The evaluator returned a response that did not match its score schema.",
					);
				const evaluation = parsed.data;
				const summary = `Structured evaluation complete. Overall score: ${evaluation.overallScore}/100. Track considered: ${evaluation.breakdown.trackRelevance.matchedTrack}.`;
				setMessages((current) => [
					...current,
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: summary,
						evaluation,
						responseSeconds: Math.floor((Date.now() - requestStartedAt) / 1000),
					},
				]);
				setLatestAssistant(summary);
				return;
			}

			const request = copilotChatRequestSchema.safeParse({
				mode: activeMode,
				context: hackathon,
				team,
				messages: visibleHistory,
			});
			if (!request.success)
				throw new Error(
					request.error.issues[0]?.message ??
						"Check your prompt and team context.",
				);
			const response = await fetch("/api/copilot/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request.data),
				signal: controller.signal,
			});
			if (!response.ok) {
				const payload: unknown = await response.json().catch(() => null);
				const message =
					typeof payload === "object" &&
					payload !== null &&
					"error" in payload &&
					typeof payload.error === "string"
						? payload.error
						: `Co-Pilot request failed (${response.status}).`;
				throw new Error(message);
			}
			if (!response.body)
				throw new Error("This browser could not open the response stream.");
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullText = "";
			try {
				while (true) {
					const chunk = await reader.read();
					if (chunk.done) break;
					fullText += decoder.decode(chunk.value, { stream: true });
					setStreamingText(fullText);
				}
			} catch {
				if (controller.signal.aborted) return;
				throw new Error(
					fullText
						? "The Co-Pilot stream was interrupted. Retry to get a complete answer."
						: "JarvisLabs did not start the Co-Pilot response. It may be waking up; please retry shortly.",
				);
			}
			fullText += decoder.decode();
			if (!fullText.trim())
				throw new Error(
					"The Co-Pilot could not generate a response. JarvisLabs may be busy or scaling up; wait a minute and retry. If this continues, contact a club admin.",
				);
			setLatestAssistant(fullText);
			if (activeMode === "sprint") recordFeatureUse("project_plan");
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: fullText,
					responseSeconds: Math.floor((Date.now() - requestStartedAt) / 1000),
				},
			]);
			setStreamingText("");
		} catch (requestError: unknown) {
			if (requestError instanceof Error && requestError.name === "AbortError")
				return;
			setError(
				requestError instanceof Error
					? requestError.message
					: "The Co-Pilot request failed.",
			);
		} finally {
			abortRef.current = null;
			requestStartedAtRef.current = null;
			setBusy(false);
			setStreamingText("");
		}
	}

	function submitForm(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		void submitMessage(mode === "evaluate" ? pitchDraft : input);
	}

	async function copyPitch(): Promise<void> {
		try {
			await navigator.clipboard.writeText(pitchDraft);
			setCopiedPitch(true);
			window.setTimeout(() => setCopiedPitch(false), 1500);
		} catch {
			setError("Clipboard access was unavailable in this browser.");
		}
	}

	const tracks = hackathon?.tracks ?? [];

	return (
		<section className="flex h-full min-h-[460px] min-w-0 overflow-hidden bg-[#11141c] text-white">
			<aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.08] bg-black/10 p-4 lg:flex">
				<div className="flex items-center gap-2">
					<span className="grid size-8 place-items-center rounded-lg border border-cyan-100/15 bg-cyan-100/[0.07] text-cyan-100">
						<Bot className="size-4" />
					</span>
					<div>
						<p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
							Context inspector
						</p>
						<p className="text-[10px] text-white/40">Validated event + team</p>
					</div>
				</div>
				<section className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
					<div className="flex items-start justify-between gap-2">
						<h2 className="text-xs font-semibold leading-5 text-white/85">
							{hackathon?.title ?? "No event selected"}
						</h2>
						<Target className="mt-0.5 size-3.5 shrink-0 text-cyan-100/55" />
					</div>
					<p className="mt-1 text-[9px] leading-4 text-white/40">
						{hackathon?.organizer ??
							"Choose a hackathon from Radar to inject its rules."}
					</p>
					<p className="mt-2 text-[9px] text-cyan-100/65">{hackathonSummary}</p>
					{hackathon && (
						<a
							href={hackathon.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-block text-[9px] text-cyan-100/75 underline decoration-cyan-100/25 underline-offset-2"
						>
							Open official event page
						</a>
					)}
				</section>
				<div className="mt-4">
					<h3 className="text-[9px] font-semibold uppercase tracking-widest text-white/45">
						Published tracks
					</h3>
					{tracks.length ? (
						<ul className="mt-2 space-y-2">
							{tracks.map((track) => (
								<li
									key={track.id}
									className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"
								>
									<p className="text-[10px] font-medium text-white/75">
										{track.title}
									</p>
									<p className="mt-1 line-clamp-3 text-[9px] leading-4 text-white/40">
										{track.description || "No track description supplied."}
									</p>
									<p className="mt-1 font-mono text-[9px] text-amber-100/75">
										{hackathon?.prizeCurrency}{" "}
										{track.prizeAmount.toLocaleString()}
									</p>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-[9px] leading-4 text-white/35">
							No track details are available in the selected record.
						</p>
					)}
				</div>
				<p className="mt-3 rounded-lg border border-amber-100/10 bg-amber-100/[0.035] p-2 text-[9px] leading-4 text-amber-50/55">
					Sponsor APIs and judging rules are not present in the current event
					schema. Check the official event page; the Co-Pilot will not invent
					them.
				</p>
				<div className="mt-4 border-t border-white/[0.08] pt-4">
					<div className="flex items-center gap-2">
						<Users className="size-3.5 text-fuchsia-100/65" />
						<h3 className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
							Your team
						</h3>
					</div>
					<div className="mt-3 grid grid-cols-2 gap-2">
						<label className="text-[9px] text-white/45">
							Members
							<input
								aria-label="Team member count"
								type="number"
								min={1}
								max={8}
								value={team.memberCount}
								onChange={(event) =>
									setTeam((current) => ({
										...current,
										memberCount: Math.min(
											8,
											Math.max(1, Number(event.target.value) || 1),
										),
									}))
								}
								className={`${fieldClass} mt-1`}
							/>
						</label>
						<label className="text-[9px] text-white/45">
							Experience
							<select
								aria-label="Team experience level"
								value={team.skillLevel}
								onChange={(event) => {
									const value = event.target.value;
									if (
										value === "beginner" ||
										value === "intermediate" ||
										value === "advanced"
									)
										setTeam((current) => ({ ...current, skillLevel: value }));
								}}
								className={`${fieldClass} mt-1`}
							>
								<option value="beginner">Beginner</option>
								<option value="intermediate">Intermediate</option>
								<option value="advanced">Advanced</option>
							</select>
						</label>
					</div>
					<p className="mt-3 text-[9px] text-white/45">Skills</p>
					<div className="mt-1.5 flex flex-wrap gap-1">
						{TEAM_SKILL_OPTIONS.map((skill) => (
							<button
								key={skill}
								type="button"
								aria-pressed={team.skills.includes(skill)}
								onClick={() => toggleSkill(skill)}
								className={`rounded-md border px-1.5 py-1 text-[8px] transition ${team.skills.includes(skill) ? "border-fuchsia-100/25 bg-fuchsia-100/10 text-fuchsia-50" : "border-white/[0.08] text-white/40 hover:text-white/70"}`}
							>
								{skill}
							</button>
						))}
					</div>
					<label className="mt-3 block text-[9px] text-white/45">
						Preferred stack
						<input
							aria-label="Preferred technology stack"
							maxLength={240}
							value={team.preferredTechStack}
							onChange={(event) =>
								setTeam((current) => ({
									...current,
									preferredTechStack: event.target.value,
								}))
							}
							placeholder="TypeScript, Python…"
							className={`${fieldClass} mt-1`}
						/>
					</label>
					<label className="mt-3 block text-[9px] text-white/45">
						Available build hours
						<select
							aria-label="Available build hours"
							value={team.availableHours}
							onChange={(event) => {
								const hours = Number(event.target.value);
								if (TEAM_HOUR_OPTIONS.some((choice) => choice === hours))
									setTeam((current) => ({ ...current, availableHours: hours }));
							}}
							className={`${fieldClass} mt-1`}
						>
							{TEAM_HOUR_OPTIONS.map((hours) => (
								<option key={hours} value={hours}>
									{hours} hours
								</option>
							))}
						</select>
					</label>
				</div>
				<button
					type="button"
					onClick={() => openRadar("radar")}
					className="mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-[9px] text-white/55 hover:border-cyan-100/20 hover:text-white"
				>
					<ChevronDown className="size-3 rotate-90" />
					Choose event in Radar
				</button>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="shrink-0 border-b border-white/[0.08] px-3 pb-2 pt-3 sm:px-4">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div>
							<p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
								AI HACKATHON CO-PILOT
							</p>
							<h1 className="mt-1 text-sm font-semibold">
								Build a project you can prove.
							</h1>
						</div>
						{hackathon && (
							<span className="max-w-[220px] truncate rounded-full border border-cyan-100/10 bg-cyan-100/[0.04] px-2.5 py-1 text-[9px] text-cyan-50/65">
								{hackathon.title}
							</span>
						)}
					</div>
					<div
						role="tablist"
						aria-label="Co-Pilot modes"
						className="mt-3 flex gap-1 overflow-x-auto"
					>
						{MODES.map((item) => (
							<button
								key={item.id}
								type="button"
								role="tab"
								aria-selected={mode === item.id}
								onClick={() => setMode(item.id)}
								className={`shrink-0 rounded-lg px-2.5 py-2 text-[9px] transition ${mode === item.id ? "bg-fuchsia-100/10 text-fuchsia-50 ring-1 ring-fuchsia-100/20" : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"}`}
							>
								{item.label}
							</button>
						))}
					</div>
				</header>

				<div
					ref={transcriptRef}
					className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
					aria-live="polite"
				>
					{messages.length === 0 && (
						<div className="mx-auto mt-3 max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
							<div className="flex items-center gap-2 text-cyan-50">
								<Sparkles className="size-4 text-fuchsia-100" />
								<h2 className="text-xs font-semibold">
									Start with your team and goal
								</h2>
							</div>
							<p className="mt-2 text-[10px] leading-5 text-white/45">
								{hackathon
									? `I have the published details for ${hackathon.title}. Share your team's skills or an idea to work through.`
									: "Open a hackathon from Radar to inject its published tracks and rules. Without one, I can still help with general planning."}
							</p>
							<div className="mt-4 grid gap-2 sm:grid-cols-2">
								{QUICK_PROMPTS.map((chip) => (
									<button
										key={chip.label}
										type="button"
										disabled={busy}
										onClick={() => {
											const targetMode: CopilotMode = chip.label.includes(
												"architecture",
											)
												? "architecture"
												: chip.label.includes("pitch")
													? "evaluate"
													: "brainstorm";
											setMode(targetMode);
											if (targetMode === "evaluate") {
												setPitchDraft(latestAssistant || input);
												return;
											}
											void submitMessage(chip.prompt, targetMode);
										}}
										className="rounded-xl border border-white/[0.08] bg-black/15 p-2.5 text-left text-[9px] text-white/60 transition hover:border-cyan-100/20 hover:text-white disabled:opacity-40"
									>
										{chip.label}
									</button>
								))}
							</div>
						</div>
					)}
					<div className="mx-auto mt-2 max-w-2xl space-y-3">
						{messages.map((message) => (
							<article
								key={message.id}
								className={`rounded-xl border p-3 ${message.role === "user" ? "ml-8 border-fuchsia-100/10 bg-fuchsia-100/[0.035]" : "mr-2 border-white/[0.08] bg-white/[0.025]"}`}
							>
								<p className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-white/35">
									{message.role === "user" ? "You" : "Co-Pilot"}
								</p>
								{message.responseSeconds !== undefined && (
									<p className="mb-1.5 font-mono text-xs text-cyan-100/45">
										Worked for {formatDuration(message.responseSeconds)}
									</p>
								)}
								{message.role === "assistant" ? (
									<MarkdownContent content={message.content} copyable />
								) : (
									<div className="whitespace-pre-wrap break-words text-[10px] leading-5 text-white/75">
										{message.content}
									</div>
								)}
								{message.evaluation && (
									<EvaluationCard result={message.evaluation} />
								)}
								{message.role === "assistant" &&
									mode === "architecture" &&
									message.content.includes("```mermaid") && (
										<div className="mt-3">
											<SpecViewer
												title={hackathon?.title ?? "Hackathon project"}
												content={message.content}
											/>
										</div>
									)}
							</article>
						))}
						{streamingText && (
							<article className="mr-2 rounded-xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3">
								<p className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-cyan-100/55">
									Co-Pilot · streaming
								</p>
								<div className="break-words text-[10px] leading-5 text-white/75">
									<MarkdownContent content={streamingText} />
									<span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-cyan-100" />
								</div>
							</article>
						)}
						{busy && !streamingText && (
							<section
								className="rounded-xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3"
								aria-label="Co-Pilot request progress and hackathon preparation tip"
							>
								<div
									role="status"
									className="flex items-center gap-2 text-xs text-white/60"
								>
									<LoaderCircle className="size-3.5 animate-spin text-cyan-100" />
									<span>Waiting for the first response</span>
									<span className="ml-auto whitespace-nowrap font-mono text-xs text-cyan-100/70">
										Working · {formatDuration(elapsedSeconds)}
									</span>
								</div>
								<div className="mt-2 border-t border-white/[0.06] pt-2">
									<p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-100/65">
										Hackathon field note
									</p>
									<p className="mt-1 text-xs leading-5 text-white/55">
										{
											WAITING_GUIDANCE[
												Math.floor(elapsedSeconds / 12) %
													WAITING_GUIDANCE.length
											]
										}
									</p>
								</div>
							</section>
						)}
						{busy && streamingText && (
							<p
								role="status"
								className="flex items-center gap-2 text-xs text-cyan-100/55"
							>
								<LoaderCircle className="size-3 animate-spin" />
								Receiving response · {formatDuration(elapsedSeconds)}
							</p>
						)}
						{error && (
							<p
								role="alert"
								className="copilot-error rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs leading-5 text-rose-200"
							>
								{error}
							</p>
						)}
					</div>
				</div>

				{latestAssistant && mode !== "architecture" && (
					<div className="shrink-0 px-3 pb-1 sm:px-4">
						<button
							type="button"
							onClick={() => setPitchDraft(latestAssistant)}
							className="text-[9px] text-cyan-100/55 underline underline-offset-2 hover:text-cyan-50"
						>
							Use latest response as an evaluation pitch
						</button>
					</div>
				)}
				{mode === "evaluate" && (
					<div className="shrink-0 px-3 pb-1 sm:px-4">
						<label
							htmlFor="copilot-pitch"
							className="mb-1 block text-[9px] text-white/45"
						>
							Pitch to evaluate
						</label>
						<textarea
							id="copilot-pitch"
							ref={pitchInputRef}
							value={pitchDraft}
							onChange={(event) => setPitchDraft(event.target.value)}
							maxLength={6000}
							placeholder="Describe the problem, intended users, core solution, and the live demo…"
							className="max-h-20 min-h-12 w-full resize-y rounded-lg border border-white/10 bg-black/15 p-2 text-[10px] leading-4 text-white/80 outline-none placeholder:text-white/25 focus:border-cyan-100/30"
						/>
						{pitchDraft && (
							<button
								type="button"
								onClick={() => {
									void copyPitch();
								}}
								className="mt-1 inline-flex items-center gap-1 text-[8px] text-white/40 hover:text-white/75"
							>
								{copiedPitch ? <Check className="size-3" /> : null}
								{copiedPitch ? "Copied" : "Copy pitch"}
							</button>
						)}
					</div>
				)}
				<form
					onSubmit={submitForm}
					className="shrink-0 border-t border-white/[0.08] bg-black/10 p-3 sm:px-4"
				>
					{mode === "evaluate" && (
						<p className="mb-1.5 text-[8px] text-white/35">
							The structured evaluator scores originality, track fit,
							feasibility, and demo impact.
						</p>
					)}
					<div className="flex items-end gap-2">
						{mode === "evaluate" ? (
							<p className="flex min-h-12 flex-1 items-center rounded-xl border border-white/[0.06] bg-[#0c1017] px-3 text-[9px] text-white/40">
								Your pitch above is sent to the structured evaluator.
							</p>
						) : (
							<>
								<label className="sr-only" htmlFor="copilot-message">
									Message the Co-Pilot
								</label>
								<textarea
									id="copilot-message"
									ref={messageInputRef}
									value={input}
									onChange={(event) => setInput(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											void submitMessage(input);
										}
									}}
									maxLength={8_000}
									rows={2}
									placeholder="Describe your team, idea, constraint, or question…"
									className="max-h-28 min-h-12 flex-1 resize-y rounded-xl border border-white/10 bg-[#0c1017] px-3 py-2.5 text-[10px] leading-4 text-white/80 outline-none placeholder:text-white/25 focus:border-cyan-100/30"
								/>
							</>
						)}
						<button
							type="submit"
							disabled={
								busy ||
								!(mode === "evaluate" ? pitchDraft.trim() : input.trim())
							}
							aria-label={
								mode === "evaluate" ? "Evaluate project pitch" : "Send message"
							}
							className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-100 text-[#102026] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
						>
							{busy ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : mode === "evaluate" ? (
								<Target className="size-4" />
							) : (
								<Send className="size-4" />
							)}
						</button>
						{busy && (
							<button
								type="button"
								onClick={() => abortRef.current?.abort()}
								aria-label="Stop response"
								className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/55 hover:text-white"
							>
								<CircleStop className="size-4" />
							</button>
						)}
					</div>
					<p className="mt-1.5 text-[8px] text-white/30">
						{mode === "evaluate"
							? "Score this pitch · Verify event rules on the official source"
							: "Enter to send · Shift+Enter for a new line · Verify event rules on the official source"}
					</p>
				</form>
			</div>
		</section>
	);
}
