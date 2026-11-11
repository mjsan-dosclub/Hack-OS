import { expect, test } from "@playwright/test";

test("opens Radar from the command palette and filters to online events", async ({
	page,
}) => {
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
	await expect(cards.first()).toBeVisible();
	const initialCardCount = await cards.count();

	await page.getByRole("button", { name: "Quick: online" }).click();

	await expect(page.getByRole("button", { name: "Online only" })).toBeVisible();
	await expect.poll(() => cards.count()).toBeLessThan(initialCardCount);
	const onlineCardCount = await cards.count();
	expect(onlineCardCount).toBeGreaterThan(0);
	expect(onlineCardCount).toBeLessThan(initialCardCount);
	await expect(page.getByText(/sample opportunities/)).toContainText(
		String(onlineCardCount),
	);
});
