import { expect, test } from "@playwright/test";
import { hackathonDisplaySchema } from "../../src/schemas/hackathon";

test("opens Radar from the command palette and filters to online events", async ({
	page,
}) => {
	// Intercept only the directory API: CI must not depend on private club data.
	const baseEvent = hackathonDisplaySchema.parse({
		id: "10000000-0000-4000-8000-000000000001",
		slug: "smoke-online",
		title: "Smoke test online event",
		description: "Browser test fixture",
		organizer: "DeScience test fixture",
		websiteUrl: "https://descienceosclub.com",
		bannerUrl: null,
		format: "online",
		venueCity: null,
		venueCountry: null,
		coordinates: null,
		startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
		endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
		registrationDeadline: null,
		applicationStatus: "open",
		source: "manual",
		verified: true,
		tracks: [],
		tags: [],
		createdAt: new Date().toISOString(),
	});
	const events = [
		baseEvent,
		hackathonDisplaySchema.parse({
			...baseEvent,
			id: "10000000-0000-4000-8000-000000000002",
			slug: "smoke-in-person",
			title: "Smoke test India event",
			format: "in-person",
			venueCity: "Chennai",
			venueCountry: "India",
		}),
	];
	await page.route("**/api/hackathons", (route) =>
		route.fulfill({ json: { events } }),
	);
	await page.goto("/");
	// Dismiss onboarding through a real click so hydration and keyboard handlers
	// are ready before testing the global shortcut.
	await page.getByRole("button", { name: "Skip for now" }).click();
	const commandShortcut =
		process.platform === "darwin" ? "Meta+k" : "Control+k";
	await page.keyboard.press(commandShortcut);

	const palette = page.getByRole("dialog", { name: "Command Palette" });
	await expect(palette).toBeVisible();
	await palette.getByRole("combobox").fill("Radar");
	await palette.getByRole("option", { name: /Launch Radar/ }).click();

	await expect(
		page.getByRole("heading", { name: "Find your next build." }),
	).toBeVisible();
	const cards = page.getByRole("article");
	await expect(cards).toHaveCount(2);
	const initialCardCount = await cards.count();

	await page.getByRole("button", { name: "Quick: online" }).click();

	await expect(page.getByRole("button", { name: "Online only" })).toBeVisible();
	await expect.poll(() => cards.count()).toBeLessThan(initialCardCount);
	const onlineCardCount = await cards.count();
	expect(onlineCardCount).toBeGreaterThan(0);
	expect(onlineCardCount).toBeLessThan(initialCardCount);
	await expect(page.getByText(/verified opportunities/)).toContainText(
		String(onlineCardCount),
	);
});
