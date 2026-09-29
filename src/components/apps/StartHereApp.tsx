"use client";

import {
	BookOpen,
	Bot,
	KeyRound,
	Radar,
	Sparkles,
	UsersRound,
} from "lucide-react";
import { useWindowManager } from "@/stores/useWindowManager";

const STEPS = [
	{
		number: "01",
		icon: KeyRound,
		title: "Know what is public and what is for members",
		text: "Anyone can browse reviewed hackathons in Radar. To use team matching and the private club workspace, sign in with the DOS Club email already on the roster. Sign-in uses a one-time email code; first access also asks you to set up an authenticator.",
	},
	{
		number: "02",
		icon: Radar,
		title: "Find an event and teammates",
		text: "Radar shows published, admin-reviewed events, their deadlines, format, prize details, and official links. In DeScience Synergy Engine, share your interests, skills, preferred roles, location, and travel range to find suitable events and potential club teammates.",
	},
	{
		number: "03",
		icon: UsersRound,
		title: "Make your profile useful",
		text: "Be specific about what you want to learn, what you can contribute, technologies you are comfortable with, and whether you can travel. Matching can only use event and member information that has been added and approved for the workspace.",
	},
	{
		number: "04",
		icon: Bot,
		title: "Turn an event into a build plan",
		text: "Open the AI Co-Pilot from an event in Radar, then choose Brainstorm Ideas, Architecture & Spec, Idea Evaluator, or Sprint Planner. Add your real team skills and available hours, review the response with your teammates, and copy the plan to share.",
	},
];

/** Quick guide explaining the public discovery surface and private club workflows. */
export function StartHereApp() {
	const openWindow = useWindowManager((state) => state.openWindow);

	return (
		<div className="h-full overflow-auto bg-[#11141c] p-5 text-white sm:p-7">
			<div className="flex items-start gap-3">
				<div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-100">
					<BookOpen className="size-5" />
				</div>
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
						HACK OS · QUICK GUIDE
					</p>
					<h1 className="mt-1 text-xl font-semibold">
						Your DeScience member workspace.
					</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
						Hack OS connects the club community to reviewed hackathons,
						compatible teammates, and project-planning tools. The public
						directory helps students discover events; member features use the
						private DOS Club workspace.
					</p>
				</div>
			</div>

			<section className="mt-6" aria-labelledby="quick-start-steps">
				<h2
					id="quick-start-steps"
					className="text-xs font-semibold uppercase tracking-widest text-white/50"
				>
					How to get started
				</h2>
				<div className="mt-3 grid gap-2">
					{STEPS.map(({ number, icon: Icon, title, text }) => (
						<article
							key={number}
							className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
						>
							<span className="pt-0.5 font-mono text-xs text-cyan-100/60">
								{number}
							</span>
							<Icon className="mt-0.5 size-4 shrink-0 text-cyan-100/80" />
							<div>
								<h3 className="text-sm font-semibold text-white/90">{title}</h3>
								<p className="mt-1 text-xs leading-5 text-white/60">{text}</p>
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
					className="flex items-center gap-2 text-sm font-semibold text-violet-100"
				>
					<Sparkles className="size-4" />
					Try this team-match request
				</h2>
				<p className="mt-2 text-sm leading-6 text-white/80">
					“We’re three DOS Club members interested in accessible education. One
					of us knows frontend, one knows Python and data, and one enjoys design
					and presenting. We have six hours to build and can attend online or
					travel within India. Find a suitable event and suggest how we could
					contribute as a team.”
				</p>
				<p className="mt-2 text-xs leading-5 text-white/55">
					Start in Synergy Engine with your own interests, roles, and travel
					preferences. Open a matched event in Radar, then use the Co-Pilot to
					brainstorm or create a sprint plan. Results depend on reviewed events
					and member profiles available to the club.
				</p>
			</section>

			<div className="mt-5 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => openWindow("synergy")}
					className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-100 px-3 text-xs font-semibold text-[#09151a] transition hover:bg-cyan-50"
				>
					<UsersRound className="size-4" />
					Find teammates
				</button>
				<button
					type="button"
					onClick={() => openWindow("radar")}
					className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/75 transition hover:border-cyan-100/30 hover:text-white"
				>
					<Radar className="size-4" />
					Browse events
				</button>
				<button
					type="button"
					onClick={() => openWindow("copilot")}
					className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-white/75 transition hover:border-violet-100/25 hover:text-white"
				>
					<Bot className="size-4" />
					Open Co-Pilot
				</button>
				<p className="basis-full pt-1 text-xs text-white/45">
					Tip: press ⌘K on Mac or Ctrl+K to find any app or action.
				</p>
			</div>

			<aside className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
				<h2 className="text-xs font-semibold text-white/80">For club admins</h2>
				<p className="mt-1 text-xs leading-5 text-white/55">
					Open Admin from your account menu to approve or update events,
					maintain the student master roster, and manage source files in the
					private Member Library. Only administrators can access these tools and
					records.
				</p>
			</aside>
		</div>
	);
}
