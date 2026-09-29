import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Unit and integration tests run without network access or a live database. */
export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			include: [
				"src/stores/useWindowManager.ts",
				"src/lib/scrapers/sanitizer.ts",
				"src/schemas/copilot.ts",
			],
			reporter: ["text", "json-summary", "lcov"],
			reportsDirectory: "coverage",
		},
	},
});
