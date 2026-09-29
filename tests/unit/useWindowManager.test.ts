import { beforeEach, describe, expect, it } from "vitest";
import { useWindowManager } from "../../src/stores/useWindowManager.ts";

describe("useWindowManager", () => {
	beforeEach(() => {
		useWindowManager.setState({
			windows: [],
			activeWindowId: null,
			radarQuery: "",
			savedHackathonIds: [],
			pendingHackathonIdea: null,
			pendingCopilotHackathon: null,
		});
	});

	it("opens a registered window and puts it at the top of the z-order", () => {
		const store = useWindowManager.getState();
		store.openWindow("terminal");
		store.openWindow("radar");

		const state = useWindowManager.getState();
		const terminal = state.windows.find((window) => window.id === "terminal");
		const radar = state.windows.find((window) => window.id === "radar");

		expect(state.activeWindowId).toBe("radar");
		expect(radar?.isOpen).toBe(true);
		expect(radar?.zIndex).toBeGreaterThan(
			terminal?.zIndex ?? Number.POSITIVE_INFINITY,
		);
	});

	it("raises an already open window and keeps compact ordered z-indices", () => {
		const store = useWindowManager.getState();
		store.openWindow("radar");
		store.openWindow("terminal");
		store.bringToFront("radar");

		const { windows, activeWindowId } = useWindowManager.getState();
		expect(activeWindowId).toBe("radar");
		expect(
			windows.find((window) => window.id === "radar")?.zIndex,
		).toBeGreaterThan(
			windows.find((window) => window.id === "terminal")?.zIndex ??
				Number.POSITIVE_INFINITY,
		);
		expect(
			windows
				.map((window) => window.zIndex)
				.sort((left, right) => left - right),
		).toEqual([100, 101]);
	});

	it("minimizes a window and focuses the next visible app", () => {
		const store = useWindowManager.getState();
		store.openWindow("radar");
		store.openWindow("terminal");
		store.minimizeWindow("terminal");

		const state = useWindowManager.getState();
		expect(
			state.windows.find((window) => window.id === "terminal")?.isMinimized,
		).toBe(true);
		expect(state.activeWindowId).toBe("radar");
	});

	it("maximizes and restores the selected window while focusing it", () => {
		const store = useWindowManager.getState();
		store.openWindow("radar");
		store.maximizeWindow("radar");
		expect(useWindowManager.getState().windows[0]?.isMaximized).toBe(true);
		store.maximizeWindow("radar");
		const state = useWindowManager.getState();
		expect(state.windows[0]?.isMaximized).toBe(false);
		expect(state.activeWindowId).toBe("radar");
	});

	it("closes a window and activates the next highest visible window", () => {
		const store = useWindowManager.getState();
		store.openWindow("radar");
		store.openWindow("terminal");
		store.closeWindow("terminal");

		const state = useWindowManager.getState();
		expect(state.windows.some((window) => window.id === "terminal")).toBe(
			false,
		);
		expect(state.activeWindowId).toBe("radar");
	});
});
