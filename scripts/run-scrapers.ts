import { syncSources } from "../src/lib/scrapers/syncEngine.ts";
import {
	HACKATHON_SCRAPER_SOURCES,
	type HackathonScraperSource,
} from "../src/lib/scrapers/types.ts";
import { z } from "zod";
import { verifyWithAggregators } from "../src/lib/scrapers/verification.ts";
import { closeDatabase } from "../src/db/client.ts";

const sourceSchema = z.enum(HACKATHON_SCRAPER_SOURCES);

function readSourceArgument(
	argumentsList: readonly string[],
): HackathonScraperSource[] {
	const sourceArgument =
		argumentsList
			.find((argument) => argument.startsWith("--source="))
			?.slice("--source=".length) ??
		(argumentsList.includes("--source")
			? argumentsList[argumentsList.indexOf("--source") + 1]
			: undefined) ??
		"all";
	if (sourceArgument === "all") return [...HACKATHON_SCRAPER_SOURCES];
	const parsed = sourceSchema.safeParse(sourceArgument);
	if (parsed.success) return [parsed.data];
	throw new Error(
		`Unsupported source "${sourceArgument}". Choose devpost, devfolio, unstop, or all.`,
	);
}

async function main(): Promise<void> {
	const argumentsList = process.argv.slice(2);
	if (!process.env.DATABASE_URL)
		throw new Error(
			"DATABASE_URL is required. Start Supabase and set it in .env.local.",
		);
	try {
		if (!argumentsList.includes("--verify-only")) {
			const summaries = await syncSources(readSourceArgument(argumentsList));
			for (const summary of summaries) console.info(JSON.stringify(summary));
			if (summaries.some((summary) => summary.errors.length > 0))
				process.exitCode = 1;
		}
		if (
			argumentsList.includes("--verify") ||
			argumentsList.includes("--verify-only")
		) {
			const checks = await verifyWithAggregators();
			for (const check of checks) console.info(JSON.stringify(check));
			if (checks.some((check) => check.error !== null)) process.exitCode = 1;
		}
	} finally {
		await closeDatabase();
	}
}

main().catch((error: unknown) => {
	console.error(
		error instanceof Error ? error.message : "Scraper runner failed.",
	);
	process.exitCode = 1;
});
