"use client";

/** Best-effort count only; telemetry must never block a completed student task. */
export function recordFeatureUse(
	activity: "teammate_match" | "project_plan",
): void {
	void fetch("/api/activity/track", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ activity }),
		keepalive: true,
	}).catch(() => undefined);
}
