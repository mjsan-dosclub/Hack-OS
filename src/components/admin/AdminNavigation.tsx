import {
	BookOpen,
	CalendarDays,
	LayoutDashboard,
	ShieldCheck,
} from "lucide-react";

type AdminSection = "overview" | "hackathons" | "library";

const sections: Array<{
	id: AdminSection;
	label: string;
	href: string;
	icon: typeof LayoutDashboard;
}> = [
	{ id: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
	{
		id: "hackathons",
		label: "Hackathons",
		href: "/admin/hackathons",
		icon: CalendarDays,
	},
	{
		id: "library",
		label: "Member library",
		href: "/admin/library",
		icon: BookOpen,
	},
];

/** Shared navigation keeps every admin destination one click from the overview. */
export function AdminNavigation({ active }: { active: AdminSection }) {
	return (
		<header className="admin-navigation mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[#151a24] shadow-xl shadow-black/10">
			<div className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4 sm:px-6">
				<div className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
					<ShieldCheck size={19} aria-hidden="true" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold tracking-tight">DeScience OS</p>
					<p className="text-xs text-white/45">Admin workspace</p>
				</div>
			</div>
			<nav
				aria-label="Admin sections"
				className="flex gap-1 overflow-x-auto p-2 sm:px-4"
			>
				{sections.map(({ id, label, href, icon: Icon }) => {
					const selected = active === id;
					return (
						<a
							key={id}
							href={href}
							aria-current={selected ? "page" : undefined}
							className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition ${selected ? "bg-cyan-200 text-slate-950 shadow-sm" : "text-white/65 hover:bg-white/[.06] hover:text-white"}`}
						>
							<Icon size={16} aria-hidden="true" />
							{label}
						</a>
					);
				})}
			</nav>
		</header>
	);
}
