import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

/** Runs one deterministic desktop smoke test against a local production-like app. */
export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		...devices["Desktop Chrome"],
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command:
			"pnpm build && pnpm exec next start --hostname 127.0.0.1 --port 3000",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
		env: {
			// Public desktop smoke tests use local, non-secret auth configuration.
			// No Supabase instance or production credentials are required.
			NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
			NEXT_PUBLIC_SUPABASE_ANON_KEY: "smoke-test-anon-key",
			DATABASE_URL: "",
			JARVISLABS_API_KEY: "",
			JARVISLABS_BASE_URL: "",
			JARVISLABS_MODEL: "",
		},
	},
});
