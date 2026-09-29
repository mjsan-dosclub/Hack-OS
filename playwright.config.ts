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
		command: "pnpm build && pnpm start -- --hostname 127.0.0.1 --port 3000",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			JARVISLABS_API_KEY: "",
			JARVISLABS_BASE_URL: "",
			JARVISLABS_MODEL: "",
		},
	},
});
