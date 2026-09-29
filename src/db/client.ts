import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/** Server-only Drizzle connection. Import only from server modules/actions. */
function createDatabase() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl)
		throw new Error("DATABASE_URL is required for database access.");
	const client = postgres(databaseUrl, { prepare: false, max: 5 });
	return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDatabase>;
let database: Database | undefined;
let closeClient: (() => Promise<void>) | undefined;

/** Delay connection setup until a request/job uses the database, so `next build` needs no secrets. */
export function getDatabase(): Database {
	if (!database) {
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error("DATABASE_URL is required for database access.");
		const client = postgres(url, { prepare: false, max: 5 });
		closeClient = () => client.end({ timeout: 5 });
		database = drizzle(client, { schema });
	}
	return database;
}

/** Closes the pooled SQL client for one-shot CLI jobs; web processes keep it open. */
export async function closeDatabase(): Promise<void> {
	if (closeClient) {
		const close = closeClient;
		closeClient = undefined;
		database = undefined;
		await close();
	}
}
