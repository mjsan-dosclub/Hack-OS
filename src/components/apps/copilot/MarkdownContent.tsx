"use client";

import { useState, type ReactNode } from "react";
import { Check, Clipboard } from "lucide-react";

interface MarkdownContentProps {
	content: string;
	className?: string;
	copyable?: boolean;
}

function uniqueKeys(values: string[]): string[] {
	const counts = new Map<string, number>();
	return values.map((value) => {
		const count = counts.get(value) ?? 0;
		counts.set(value, count + 1);
		return `${value}:${count}`;
	});
}

function inline(source: string): ReactNode[] {
	const tokenPattern =
		/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
	const tokens = source.split(tokenPattern).filter(Boolean);
	const keys = uniqueKeys(tokens);
	return tokens.map((token, tokenIndex) => {
		const key = keys[tokenIndex] ?? token;
		if (
			(token.startsWith("**") && token.endsWith("**")) ||
			(token.startsWith("__") && token.endsWith("__"))
		) {
			return (
				<strong key={key} className="font-semibold text-white/95">
					{token.slice(2, -2)}
				</strong>
			);
		}
		if (token.startsWith("`") && token.endsWith("`")) {
			return (
				<code
					key={key}
					className="rounded bg-black/35 px-1 py-0.5 font-mono text-cyan-100"
				>
					{token.slice(1, -1)}
				</code>
			);
		}
		if (
			(token.startsWith("*") && token.endsWith("*")) ||
			(token.startsWith("_") && token.endsWith("_"))
		) {
			return (
				<em key={key} className="italic text-white/90">
					{token.slice(1, -1)}
				</em>
			);
		}
		const link = token.match(
			/^\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+)\)$/i,
		);
		if (link?.[1] && link[2]) {
			return (
				<a
					key={key}
					href={link[2]}
					target="_blank"
					rel="noreferrer"
					className="text-cyan-200 underline decoration-cyan-200/40 underline-offset-2"
				>
					{link[1]}
				</a>
			);
		}
		return token;
	});
}

function cells(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
	const values = cells(line);
	return (
		line.includes("|") &&
		values.length > 0 &&
		values.every((cell) => /^:?-{3,}:?$/.test(cell))
	);
}

function isBlockStart(lines: string[], index: number): boolean {
	const line = lines[index] ?? "";
	return (
		/^#{1,4}\s+/.test(line) ||
		/^```/.test(line) ||
		/^\s*[-*+]\s+/.test(line) ||
		/^\s*\d+[.)]\s+/.test(line) ||
		/^\s*>/.test(line) ||
		/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line) ||
		(line.includes("|") && isTableSeparator(lines[index + 1] ?? ""))
	);
}

/** Safe, dependency-free rendering for the Markdown subset returned by the Co-Pilot. */
export function MarkdownContent({
	content,
	className = "",
	copyable = false,
}: MarkdownContentProps) {
	const [copied, setCopied] = useState(false);
	const lines = content.replaceAll("\r\n", "\n").split("\n");
	const blocks: ReactNode[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (!line.trim()) {
			index += 1;
			continue;
		}

		const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
		if (heading?.[1] && heading[2]) {
			const size =
				heading[1].length === 1
					? "text-base"
					: heading[1].length === 2
						? "text-sm"
						: "text-xs";
			blocks.push(
				<h3
					key={index}
					className={`${size} mb-1 mt-4 first:mt-0 font-semibold text-white/95`}
				>
					{inline(heading[2])}
				</h3>,
			);
			index += 1;
			continue;
		}

		if (/^```/.test(line)) {
			const code: string[] = [];
			index += 1;
			while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
				code.push(lines[index] ?? "");
				index += 1;
			}
			if (index < lines.length) index += 1;
			blocks.push(
				<pre
					key={`code-${index}`}
					className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] leading-5 text-cyan-50/85"
				>
					<code>{code.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		if (line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
			const headers = cells(line);
			const headerKeys = uniqueKeys(headers);
			index += 2;
			const rows: string[][] = [];
			while (index < lines.length && (lines[index] ?? "").includes("|")) {
				rows.push(cells(lines[index] ?? ""));
				index += 1;
			}
			const rowKeys = uniqueKeys(rows.map((row) => row.join("\u001f")));
			blocks.push(
				<div
					key={`table-${index}`}
					className="my-2 max-w-full overflow-x-auto rounded-lg border border-white/10"
				>
					<table className="w-full min-w-[620px] border-collapse text-left text-[9px] leading-4">
						<thead className="bg-white/[0.06] text-cyan-100/90">
							<tr>
								{headers.map((value, cellIndex) => (
									<th
										key={headerKeys[cellIndex] ?? value}
										className="border-b border-white/10 px-2.5 py-2 font-semibold"
									>
										{inline(value)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, rowIndex) => (
								<tr key={rowKeys[rowIndex]} className="odd:bg-white/[0.02]">
									{headers.map((_, cellIndex) => (
										<td
											key={headerKeys[cellIndex] ?? String(cellIndex)}
											className="max-w-[320px] border-b border-white/[0.06] px-2.5 py-2 align-top whitespace-normal text-white/75"
										>
											{inline(row[cellIndex] ?? "")}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
			blocks.push(<hr key={index} className="my-3 border-white/10" />);
			index += 1;
			continue;
		}

		const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
		if (listMatch?.[2] && listMatch[3]) {
			const ordered = /^\d/.test(listMatch[2]);
			const items: Array<{ text: string; indent: number }> = [];
			while (index < lines.length) {
				const match = (lines[index] ?? "").match(
					/^(\s*)([-*+]|\d+[.)])\s+(.+)$/,
				);
				if (!match?.[2] || !match[3] || /^\d/.test(match[2]) !== ordered) break;
				items.push({
					text: match[3],
					indent: Math.min(3, Math.floor((match[1]?.length ?? 0) / 2)),
				});
				index += 1;
			}
			const List = ordered ? "ol" : "ul";
			const indentClass = ["", "ml-3", "ml-6", "ml-9"] as const;
			const itemKeys = uniqueKeys(
				items.map((item) => `${item.indent}:${item.text}`),
			);
			blocks.push(
				<List
					key={`list-${index}`}
					className={`${ordered ? "list-decimal" : "list-disc"} my-1 space-y-1 pl-5 marker:text-cyan-200/70`}
				>
					{items.map((item, itemIndex) => (
						<li key={itemKeys[itemIndex]} className={indentClass[item.indent]}>
							{inline(item.text)}
						</li>
					))}
				</List>,
			);
			continue;
		}

		const paragraph: string[] = [];
		while (
			index < lines.length &&
			(lines[index] ?? "").trim() &&
			!isBlockStart(lines, index)
		) {
			paragraph.push((lines[index] ?? "").trim());
			index += 1;
		}
		if (paragraph.length === 0) {
			paragraph.push(line.trim());
			index += 1;
		}
		blocks.push(
			<p key={`paragraph-${index}`} className="my-1.5 leading-5 text-white/75">
				{inline(paragraph.join(" "))}
			</p>,
		);
	}

	async function copyResponse(): Promise<void> {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className={`break-words text-[10px] leading-5 ${className}`}>
			{copyable && (
				<div className="mb-1 flex justify-end">
					<button
						type="button"
						onClick={() => void copyResponse()}
						className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 px-2 text-[9px] text-white/50 transition hover:border-cyan-100/25 hover:text-cyan-50"
						aria-label="Copy response as Markdown"
					>
						{copied ? (
							<Check className="size-3" />
						) : (
							<Clipboard className="size-3" />
						)}
						{copied ? "Copied" : "Copy response"}
					</button>
				</div>
			)}
			{blocks}
		</div>
	);
}
