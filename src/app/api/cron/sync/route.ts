import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { syncSources } from "../../../../lib/scrapers/syncEngine.ts";
import type { ScraperName } from "../../../../lib/scrapers/types.ts";
import { verifyWithAggregators } from "../../../../lib/scrapers/verification.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sourceSchema = z.enum(["devpost", "devfolio", "unstop"]);

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	const token = request.headers
		.get("authorization")
		?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!secret || !token) return false;
	// Hash both strings first to compare fixed-length buffers without exposing token length.
	const expected = createHash("sha256").update(secret).digest();
	const provided = createHash("sha256").update(token).digest();
	return timingSafeEqual(expected, provided);
}

async function handle(request: Request): Promise<Response> {
	if (!authorized(request))
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	const requestedSource = new URL(request.url).searchParams.get("source");
	let sources: readonly ScraperName[];
	if (requestedSource === null || requestedSource === "all") {
		sources = ["devpost", "devfolio", "unstop"];
	} else {
		const parsed = sourceSchema.safeParse(requestedSource);
		if (!parsed.success)
			return Response.json(
				{ error: "source must be devpost, devfolio, unstop, or all." },
				{ status: 400 },
			);
		sources = [parsed.data];
	}
	try {
		const summaries = await syncSources(sources);
		const verification =
			new URL(request.url).searchParams.get("verify") === "true"
				? await verifyWithAggregators()
				: undefined;
		const hasErrors = summaries.some((summary) => summary.errors.length > 0);
		const verificationFailed =
			verification?.some((summary) => summary.error !== null) ?? false;
		return Response.json(
			{ summaries, verification },
			{ status: hasErrors || verificationFailed ? 207 : 200 },
		);
	} catch (error: unknown) {
		console.error(
			JSON.stringify({
				level: "error",
				event: "cron_sync_failed",
				detail: error instanceof Error ? error.message : "unknown error",
			}),
		);
		return Response.json(
			{ error: "Hackathon sync could not complete." },
			{ status: 500 },
		);
	}
}

/** GitHub/manual invocation. Vercel Cron invokes GET with Authorization: Bearer CRON_SECRET. */
export const GET = handle;
export const POST = handle;
