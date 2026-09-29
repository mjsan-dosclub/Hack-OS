"use client";

import { useEffect, useMemo, useState } from "react";
import { useWindowManager } from "../stores/useWindowManager.ts";
import type { Hackathon } from "../types/hackathon.ts";
import type { TeamProfile } from "../schemas/copilot.ts";

export const TEAM_SKILL_OPTIONS = [
	"Frontend",
	"Backend",
	"Python",
	"Data / ML",
	"Design",
	"Product",
	"Pitching",
	"Hardware / IoT",
] as const;
export const TEAM_HOUR_OPTIONS = [12, 24, 36, 48, 72] as const;

/** Holds the selected event plus editable team constraints for one Co-Pilot session. */
export function useCopilotContext() {
	const pendingHackathon = useWindowManager(
		(state) => state.pendingCopilotHackathon,
	);
	const clearPendingHackathon = useWindowManager(
		(state) => state.setPendingCopilotHackathon,
	);
	const [hackathon, setHackathon] = useState<Hackathon | null>(null);
	const [team, setTeam] = useState<TeamProfile>({
		memberCount: 3,
		skillLevel: "intermediate",
		skills: ["Frontend", "Backend"],
		preferredTechStack: "",
		availableHours: 36,
	});

	useEffect(() => {
		if (!pendingHackathon) return;
		setHackathon(pendingHackathon);
		clearPendingHackathon(null);
	}, [pendingHackathon, clearPendingHackathon]);

	const eventDurationDays = useMemo(() => {
		if (!hackathon) return null;
		return Math.max(
			1,
			Math.ceil(
				(Date.parse(hackathon.endDate) - Date.parse(hackathon.startDate)) /
					86_400_000,
			) + 1,
		);
	}, [hackathon]);

	function toggleSkill(skill: string): void {
		setTeam((current) => ({
			...current,
			skills: current.skills.includes(skill)
				? current.skills.filter((item) => item !== skill)
				: [...current.skills, skill].slice(0, 12),
		}));
	}

	return {
		hackathon,
		setHackathon,
		eventDurationDays,
		team,
		setTeam,
		toggleSkill,
	} as const;
}
