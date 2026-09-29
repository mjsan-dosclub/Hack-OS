import {
	ArrowUpRight,
	BookOpen,
	CalendarDays,
	LayoutDashboard,
	ShieldCheck,
	UsersRound,
} from "lucide-react";

type AdminSection = "overview" | "hackathons" | "students" | "library";

const sections: Array<{
	id: AdminSection;
	label: string;
	description: string;
	href: string;
	icon: typeof LayoutDashboard;
}> = [
	{
		id: "overview",
		label: "Overview",
		description: "Club activity",
		href: "/admin",
		icon: LayoutDashboard,
	},
	{
		id: "hackathons",
		label: "Hackathons",
		description: "Event operations",
		href: "/admin/hackathons",
		icon: CalendarDays,
	},
	{
		id: "students",
		label: "Students",
		description: "Master roster & activity",
		href: "/admin/students",
		icon: UsersRound,
	},
	{
		id: "library",
		label: "Member library",
		description: "Ollama knowledge files",
		href: "/admin/library",
		icon: BookOpen,
	},
];

/** Enterprise-style admin rail with a compact, touch-friendly mobile header. */
export function AdminNavigation({ active }: { active: AdminSection }) {
	return (
		<aside className="admin-navigation mb-7 lg:mb-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-white/10 lg:bg-[#151a24] lg:px-4 lg:py-6">
			<a href="/admin" className="flex min-h-14 items-center gap-3 px-2">
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
					<ShieldCheck size={20} aria-hidden="true" />
				</span>
				<span className="min-w-0">
					<span className="block text-sm font-semibold tracking-tight">
						DeScience OS
					</span>
					<span className="mt-0.5 block text-xs text-white/45">
						Admin workspace
					</span>
				</span>
			</a>
			<div className="mt-8 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 lg:block">
				Workspace
			</div>
			<nav
				aria-label="Admin sections"
				className="mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#151a24] p-2 lg:flex-col lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0"
			>
				{sections.map(({ id, label, description, href, icon: Icon }) => {
					const selected = active === id;
					return (
						<a
							key={id}
							href={href}
							aria-current={selected ? "page" : undefined}
							className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition lg:w-full lg:gap-3 ${selected ? "bg-cyan-200 font-semibold text-slate-950 shadow-sm" : "text-white/65 hover:bg-white/[.06] hover:text-white"}`}
						>
							<Icon size={17} aria-hidden="true" />
							<span className="min-w-0 lg:flex-1">
								<span className="block whitespace-nowrap">{label}</span>
								<span
									className={`hidden text-xs lg:block ${selected ? "text-slate-700/80" : "text-white/35"}`}
								>
									{description}
								</span>
							</span>
						</a>
					);
				})}
			</nav>
			<div className="mt-auto hidden border-t border-white/10 pt-4 lg:block">
				<a
					href="/"
					className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-white/55 transition hover:bg-white/[.06] hover:text-white"
				>
					<span>Open desktop</span>
					<ArrowUpRight size={15} aria-hidden="true" />
				</a>
				<p className="px-3 pt-2 text-[11px] text-white/30">
					DeScience Open Source Club
				</p>
			</div>
		</aside>
	);
}
