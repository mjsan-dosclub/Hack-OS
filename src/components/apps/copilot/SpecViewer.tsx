"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download, Workflow } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

interface SpecViewerProps {
	title: string;
	content: string;
}

interface DiagramNode {
	id: string;
	label: string;
}
interface DiagramEdge {
	from: string;
	to: string;
}

function readDiagram(source: string): {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
} {
	const nodes = new Map<string, string>();
	const edges: DiagramEdge[] = [];
	const lines = source
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	for (const line of lines) {
		if (
			/^(flowchart|graph|subgraph|end|classDef|style|linkStyle|%%)/i.test(line)
		)
			continue;
		const tokens = [
			...line.matchAll(
				/([A-Za-z][\w-]*)(?:\s*\[([^\]]{1,100})\]|\s*\(([^)]{1,100})\)|\s*\{([^}]{1,100})\})?/g,
			),
		]
			.map((match) => ({
				id: match[1] ?? "",
				label: (match[2] ?? match[3] ?? match[4] ?? match[1] ?? "")
					.replaceAll('"', "")
					.trim(),
			}))
			.filter(
				(node) => node.id && !["TD", "TB", "LR", "RL", "BT"].includes(node.id),
			);
		for (const node of tokens)
			if (!nodes.has(node.id)) nodes.set(node.id, node.label || node.id);
		if (/-->|---|==>|-\.->/.test(line) && tokens.length > 1) {
			for (let index = 0; index < tokens.length - 1; index += 1) {
				const from = tokens[index]?.id;
				const to = tokens[index + 1]?.id;
				if (from && to && from !== to) edges.push({ from, to });
			}
		}
	}
	return {
		nodes: [...nodes]
			.slice(0, 14)
			.map(([id, label]) => ({ id, label: label.slice(0, 70) })),
		edges: edges.slice(0, 24),
	};
}

function mermaidFromContent(content: string): string | null {
	return content.match(/```mermaid\s*([\s\S]*?)```/i)?.[1]?.trim() ?? null;
}

function MermaidDiagram({ source }: { source: string }) {
	const graph = useMemo(() => readDiagram(source), [source]);
	if (graph.nodes.length < 2 || graph.edges.length === 0) {
		return (
			<pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-3 text-[10px] leading-5 text-cyan-50/75">
				{source}
			</pre>
		);
	}
	const columns = 3;
	const rows = Math.ceil(graph.nodes.length / columns);
	const height = Math.max(180, rows * 130 + 24);
	const center = (id: string): { x: number; y: number } => {
		const index = graph.nodes.findIndex((node) => node.id === id);
		if (index < 0) return { x: 0, y: 0 };
		return {
			x: 130 + (index % columns) * 250,
			y: 52 + Math.floor(index / columns) * 130,
		};
	};
	return (
		<div className="overflow-x-auto rounded-xl border border-cyan-100/10 bg-[#0c1119]/75 p-2">
			<svg
				role="img"
				aria-label="Architecture flowchart rendered from the Mermaid response"
				viewBox={`0 0 760 ${height}`}
				className="min-w-[660px] w-full"
				xmlns="http://www.w3.org/2000/svg"
			>
				<defs>
					<marker
						id="copilot-arrowhead"
						markerWidth="8"
						markerHeight="8"
						refX="7"
						refY="3"
						orient="auto"
					>
						<path d="M0,0 L0,6 L8,3 z" fill="#67e8f9" />
					</marker>
				</defs>
				{graph.edges.map((edge) => {
					const from = center(edge.from);
					const to = center(edge.to);
					return (
						<line
							key={`${edge.from}-${edge.to}`}
							x1={from.x}
							y1={from.y + 25}
							x2={to.x}
							y2={to.y - 25}
							stroke="#67e8f9"
							strokeOpacity=".55"
							strokeWidth="1.5"
							markerEnd="url(#copilot-arrowhead)"
						/>
					);
				})}
				{graph.nodes.map((node) => {
					const point = center(node.id);
					return (
						<g key={node.id}>
							<rect
								x={point.x - 104}
								y={point.y - 24}
								width="208"
								height="48"
								rx="12"
								fill="#17212b"
								stroke="#67e8f9"
								strokeOpacity=".42"
							/>
							<text
								x={point.x}
								y={point.y + 4}
								textAnchor="middle"
								fill="#e0f2fe"
								fontSize="11"
								fontFamily="ui-monospace, monospace"
							>
								{node.label.length > 32
									? `${node.label.slice(0, 29)}…`
									: node.label}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}

/** Safe, dependency-free Mermaid flowchart subset renderer and GitHub README exporter. */
export function SpecViewer({ title, content }: SpecViewerProps) {
	const [copied, setCopied] = useState(false);
	const mermaid = mermaidFromContent(content);
	const readme = `# ${title.trim() || "Hackathon Project"}\n\n## Project spec\n\n${content.trim()}\n\n## Build notes\n\n- Confirm event rules and dates on the official event page.\n- Keep credentials in server-side environment variables.\n- Validate inputs at every API boundary.\n`;

	async function copyReadme(): Promise<void> {
		try {
			await navigator.clipboard.writeText(readme);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			setCopied(false);
		}
	}

	return (
		<section
			className="space-y-3"
			aria-label="Architecture and project specification"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs font-semibold text-cyan-50">
					<Workflow className="size-4 text-cyan-200" />
					Architecture
				</div>
				<button
					type="button"
					onClick={() => {
						void copyReadme();
					}}
					className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[10px] text-white/70 hover:border-cyan-100/25 hover:text-white"
					aria-label="Copy project spec as GitHub README markdown"
				>
					{copied ? (
						<Check className="size-3.5" />
					) : (
						<Clipboard className="size-3.5" />
					)}
					{copied ? "README copied" : "Export README"}
					<Download className="size-3" />
				</button>
			</div>
			{mermaid && <MermaidDiagram source={mermaid} />}
			<div className="max-h-64 overflow-auto rounded-xl border border-white/[0.08] bg-black/20 p-3">
				<MarkdownContent content={content} />
			</div>
		</section>
	);
}
