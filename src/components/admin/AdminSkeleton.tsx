type SkeletonKind = "dashboard" | "table" | "review" | "library";
const metricSlots = [
	"metric-a",
	"metric-b",
	"metric-c",
	"metric-d",
	"metric-e",
];
const panelSlots = ["panel-a", "panel-b", "panel-c", "panel-d"];
const lineSlots = ["line-a", "line-b", "line-c"];
const columnSlots = ["column-a", "column-b", "column-c", "column-d"];
const tableSlots = ["row-a", "row-b", "row-c", "row-d", "row-e", "row-f"];
const librarySlots = ["item-a", "item-b", "item-c", "item-d", "item-e"];

function Block({ className = "" }: { className?: string }) {
	return (
		<div className={`animate-pulse rounded-lg bg-white/[0.07] ${className}`} />
	);
}

/** Shared loading silhouettes preserve the page layout while admin data loads. */
export function AdminSkeleton({ kind }: { kind: SkeletonKind }) {
	return (
		<div
			role="status"
			aria-label="Loading admin content"
			aria-busy="true"
			className="mt-6"
		>
			<span className="sr-only">Loading admin content…</span>
			{kind === "dashboard" ? (
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{metricSlots.map((slot) => (
							<div
								key={slot}
								className="rounded-2xl border border-white/10 bg-[#151a24] p-4"
							>
								<Block className="h-3 w-28" />
								<Block className="mt-4 h-8 w-16" />
							</div>
						))}
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						{panelSlots.map((slot) => (
							<div
								key={slot}
								className="rounded-2xl border border-white/10 bg-[#151a24] p-5"
							>
								<Block className="h-4 w-36" />
								{lineSlots.map((slot) => (
									<Block key={slot} className="mt-5 h-3 w-full" />
								))}
							</div>
						))}
					</div>
				</div>
			) : kind === "table" ? (
				<div className="overflow-hidden rounded-2xl border border-white/10">
					<div className="grid grid-cols-4 gap-4 border-b border-white/10 bg-white/[0.03] p-4">
						{columnSlots.map((slot) => (
							<Block key={slot} className="h-3 w-24" />
						))}
					</div>
					{tableSlots.map((row) => (
						<div
							key={row}
							className="grid grid-cols-4 gap-4 border-b border-white/[0.06] p-4 last:border-0"
						>
							{columnSlots.map((column) => (
								<Block key={column} className="h-4 w-full max-w-40" />
							))}
						</div>
					))}
				</div>
			) : (
				<div className="space-y-3">
					{librarySlots.slice(0, kind === "review" ? 4 : 5).map((slot) => (
						<div
							key={slot}
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#151a24] p-4"
						>
							<Block className="size-10 shrink-0 rounded-xl" />
							<div className="min-w-0 flex-1">
								<Block className="h-4 w-2/5" />
								<Block className="mt-3 h-3 w-3/5" />
							</div>
							<Block className="h-8 w-20" />
						</div>
					))}
				</div>
			)}
		</div>
	);
}
