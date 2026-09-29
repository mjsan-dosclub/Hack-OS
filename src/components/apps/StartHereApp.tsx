"use client";

import { BookOpen, Bot, Map as MapIcon, Radar, Sparkles } from "lucide-react";
import { useWindowManager } from "@/stores/useWindowManager";

const STEPS = [
	{
		number: "01",
		icon: Radar,
		title: "Find a hackathon",
		text: "Open Radar to browse events, registration deadlines, formats, prize details, and official links. Confirm the final rules on the event website.",
	},
	{
		number: "02",
		icon: MapIcon,
		title: "Check where it is",
		text: "Open Hackamaps to explore in-person events across India and see which opportunities are online. Use this view to decide whether travel may be needed.",
	},
	{
		number: "03",
		icon: Bot,
		title: "Make a build plan",
		text: "Open the Co-Pilot, choose Sprint Planner, and tell it your team size, skills, and available hours. It can turn an idea into tasks and checkpoints.",
	},
];

export function StartHereApp() {
	const openWindow = useWindowManager((state) => state.openWindow);
	return (
		<div className="h-full overflow-auto bg-[#11141c] p-5 text-white sm:p-7">
			<div className="flex items-start gap-3">
				<div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-100">
					<BookOpen className="size-5" />
				</div>
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
						HACK OS · QUICK START
					</p>
					<h1 className="mt-1 text-xl font-semibold">
						A launchpad for your next hackathon.
					</h1>
					<p className="mt-2 max-w-2xl text-xs leading-5 text-white/55">
						Hack OS helps students discover hackathons in India or online, check
						deadlines and locations, then shape a practical project plan with an
						AI co-pilot.
					</p>
				</div>
			</div>

			<section className="mt-6" aria-labelledby="quick-start-steps">
				<h2
					id="quick-start-steps"
					className="text-xs font-semibold uppercase tracking-widest text-white/45"
				>
					Your first three steps
				</h2>
				<div className="mt-3 grid gap-2">
					{STEPS.map(({ number, icon: Icon, title, text }) => (
						<article
							key={number}
							className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
						>
							<span className="pt-0.5 font-mono text-[10px] text-cyan-100/55">
								{number}
							</span>
							<Icon className="mt-0.5 size-4 shrink-0 text-cyan-100/80" />
							<div>
								<h3 className="text-xs font-semibold text-white/90">{title}</h3>
								<p className="mt-1 text-[10px] leading-4 text-white/55">
									{text}
								</p>
							</div>
						</article>
					))}
				</div>
			</section>

			<section
				className="mt-5 rounded-xl border border-violet-200/15 bg-violet-200/[0.04] p-3.5"
				aria-labelledby="quick-start-example"
			>
				<h2
					id="quick-start-example"
					className="flex items-center gap-2 text-xs font-semibold text-violet-100"
				>
					<Sparkles className="size-3.5" />
					Try this sample
				</h2>
				<p className="mt-2 text-[11px] leading-5 text-white/75">
					“We’re three students with six hours to build. Help us plan a
					beginner-friendly campus wayfinding app for an upcoming online or
					India-based hackathon.”
				</p>
				<p className="mt-2 text-[10px] leading-4 text-white/45">
					In Sprint Planner, add your actual skills and available hours. Review
					the suggested tasks, adjust them with your team, and copy the plan to
					share.
				</p>
			</section>

			<div className="mt-5 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => openWindow("radar")}
					className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-100 px-3 text-[10px] font-semibold text-[#09151a] transition hover:bg-cyan-50"
				>
					<Radar className="size-3.5" />
					Open Radar
				</button>
				<button
					type="button"
					onClick={() => openWindow("copilot")}
					className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] text-white/75 transition hover:border-violet-100/25 hover:text-white"
				>
					<Bot className="size-3.5" />
					Open Co-Pilot
				</button>
				<p className="basis-full pt-1 text-[9px] text-white/35">
					Tip: press ⌘K on Mac or Ctrl+K to find any app or action.
				</p>
			</div>
		</div>
	);
}
