"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, Terminal as TerminalIcon } from "lucide-react";
import { MOCK_HACKATHONS } from "@/lib/mockHackathons";

type TerminalLine = {
	id: number;
	kind: "command" | "output" | "error";
	text: string;
};

const ABOUT_LINES = [
	"DeScience Open Source Club is a student-driven community for learning, building, and contributing in the open.",
	"Members learn through guided tracks, workshops, real projects, mentorship, and open-source contributions.",
	"Source: https://descienceosclub.com/",
];

const HELP_LINES = [
	"help                 Show available commands",
	"about                Learn about the DeScience Open Source Club",
	"hackathons           Show events currently in the local directory",
	"join                 Open the membership portal URL",
	"clear                Clear terminal history",
	"whoami               Show the current local session",
	"matrix               A harmless terminal easter egg",
];

function commandResult(
	command: string,
): { kind: TerminalLine["kind"]; text: string }[] | null {
	switch (command) {
		case "help":
			return [{ kind: "output", text: HELP_LINES.join("\n") }];
		case "about":
			return ABOUT_LINES.map((text) => ({ kind: "output", text }));
		case "hackathons":
			return [
				{
					kind: "output",
					text: `${MOCK_HACKATHONS.length} illustrative sample hackathons are loaded. Dates and prizes need verification on the linked source directories.`,
				},
			];
		case "join":
			return [
				{
					kind: "output",
					text: "Membership portal: https://membership.descienceosclub.com/",
				},
			];
		case "whoami":
			return [
				{ kind: "output", text: "guest@hack-os · local browser session" },
			];
		case "matrix":
			return [
				{
					kind: "output",
					text: "Wake up, builder. The open-source rabbit hole is waiting. 🐇",
				},
			];
		case "sudo make me a sandwich":
			return [{ kind: "output", text: "Okay. 🥪" }];
		case "rm -rf /":
		case "sudo rm -rf /":
			return [
				{
					kind: "error",
					text: "Permission denied: this terminal is a safe browser simulation.",
				},
			];
		case "":
			return [];
		default:
			return null;
	}
}

export function TerminalApp() {
	const [lines, setLines] = useState<TerminalLine[]>([
		{
			id: 0,
			kind: "output",
			text: "DeScience OS Club terminal · browser session",
		},
		{ id: 1, kind: "output", text: "Type `help` to see available commands." },
	]);
	const [command, setCommand] = useState("");
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const nextId = useRef(2);
	const outputRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const output = outputRef.current;
		if (!output) return;
		output.scrollTo({
			top: lines.length === 0 ? 0 : output.scrollHeight,
			behavior: "smooth",
		});
	}, [lines.length]);

	function submitCommand(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const raw = command.trim();
		const normalized = raw.toLowerCase();
		setCommand("");
		setHistoryIndex(-1);
		if (normalized === "clear") {
			setLines([]);
			setHistory((current) => [...current, raw]);
			return;
		}

		const userLine: TerminalLine = {
			id: nextId.current++,
			kind: "command",
			text: raw,
		};
		const results = commandResult(normalized);
		const outputLines: { kind: TerminalLine["kind"]; text: string }[] =
			results ?? [
				{
					kind: "error",
					text: `Command not found: ${raw}. Type "help" to see available commands.`,
				},
			];
		setLines((current) => [
			...current,
			userLine,
			...outputLines.map((item) => ({ ...item, id: nextId.current++ })),
		]);
		if (raw) setHistory((current) => [...current, raw]);
	}

	function navigateHistory(direction: "up" | "down") {
		if (!history.length) return;
		if (direction === "up") {
			const next = Math.min(historyIndex + 1, history.length - 1);
			setHistoryIndex(next);
			setCommand(history[history.length - 1 - next] ?? "");
		} else if (historyIndex <= 0) {
			setHistoryIndex(-1);
			setCommand("");
		} else {
			const next = historyIndex - 1;
			setHistoryIndex(next);
			setCommand(history[history.length - 1 - next] ?? "");
		}
	}

	return (
		<section className="flex h-full min-h-0 flex-col bg-[#090d0d] font-mono text-[12px] text-emerald-100/80">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.07] px-4 text-[10px] text-white/40">
				<TerminalIcon className="size-3.5 text-emerald-300/70" />
				<span>dos-club-shell</span>
				<span className="ml-auto">zsh · browser session</span>
			</div>
			<div
				ref={outputRef}
				role="log"
				aria-live="polite"
				aria-label="Terminal output"
				className="min-h-0 flex-1 overflow-auto p-4 sm:p-5"
			>
				{lines.map((line) => (
					<div
						key={line.id}
						className={`mb-2 whitespace-pre-wrap leading-5 ${line.kind === "command" ? "text-white" : line.kind === "error" ? "text-rose-300" : "text-emerald-100/65"}`}
					>
						{line.kind === "command" && (
							<>
								<span className="text-cyan-200">visitor@dos-club</span>
								<span className="text-white/30">:~$ </span>
							</>
						)}
						{line.text}
					</div>
				))}
			</div>
			<form
				onSubmit={submitCommand}
				className="flex shrink-0 items-center gap-2 border-t border-white/[0.07] px-4 py-3"
			>
				<ChevronRight className="size-3.5 shrink-0 text-emerald-300" />
				<label htmlFor="terminal-command" className="sr-only">
					Enter a terminal command
				</label>
				<input
					id="terminal-command"
					ref={inputRef}
					value={command}
					onChange={(event) => setCommand(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "ArrowUp") {
							event.preventDefault();
							navigateHistory("up");
						}
						if (event.key === "ArrowDown") {
							event.preventDefault();
							navigateHistory("down");
						}
					}}
					autoComplete="off"
					spellCheck={false}
					aria-label="Terminal command"
					placeholder="Type a command…"
					className="min-w-0 flex-1 bg-transparent text-emerald-100 outline-none placeholder:text-emerald-100/25"
				/>
				<kbd className="hidden text-[9px] text-white/25 sm:block">ENTER</kbd>
			</form>
		</section>
	);
}
