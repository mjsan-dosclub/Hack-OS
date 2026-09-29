"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { hackathonDisplaySchema } from "@/schemas/hackathon";
import type { Hackathon } from "@/types/hackathon";

const responseSchema = z
	.object({ events: z.array(hackathonDisplaySchema).max(250) })
	.strict();

/** Refreshes on focus so a newly approved event appears without a page reload. */
export function usePublishedHackathons() {
	const [events, setEvents] = useState<Hackathon[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const refresh = useCallback(async () => {
		try {
			const response = await fetch("/api/hackathons", { cache: "no-store" });
			if (!response.ok) throw new Error("Could not load verified hackathons.");
			const parsed = responseSchema.safeParse(await response.json());
			if (!parsed.success) throw new Error("Event data is invalid.");
			setEvents(parsed.data.events);
			setError("");
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not load verified hackathons.",
			);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void refresh();
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, [refresh]);
	return { events, loading, error, refresh };
}
