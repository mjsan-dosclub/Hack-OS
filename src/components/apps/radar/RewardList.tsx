import type { HackathonReward } from "@/types/hackathon";

const CATEGORY_LABELS: Record<HackathonReward["category"], string> = {
	cash: "Cash",
	software: "Tools",
	credits: "Credits",
	certificate: "Certificate",
	interview: "Interview",
	kit: "Kit",
	merchandise: "Merchandise",
	other: "Reward",
};

interface RewardListProps {
	rewards: HackathonReward[];
	compact?: boolean;
}

export function RewardList({ rewards, compact = false }: RewardListProps) {
	if (rewards.length === 0) return null;
	const shown = compact ? rewards.slice(0, 2) : rewards;
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="Event rewards">
			{shown.map((reward) => (
				<li
					key={reward.id}
					className="rounded-full border border-violet-200/20 bg-violet-200/[0.07] px-2.5 py-1 text-[10px] text-violet-100/90"
					title={`${CATEGORY_LABELS[reward.category]} · ${reward.recipient}`}
				>
					<span className="font-semibold">
						{CATEGORY_LABELS[reward.category]}:
					</span>{" "}
					{reward.name}
				</li>
			))}
			{compact && rewards.length > shown.length && (
				<li className="self-center text-[10px] text-white/45">
					+{rewards.length - shown.length} more
				</li>
			)}
		</ul>
	);
}
