"use client";

import { create } from "zustand";
import type { Hackathon } from "../types/hackathon.ts";

export interface WindowPosition {
	x: number;
	y: number;
}
export interface WindowSize {
	width: number;
	height: number;
}
export interface DesktopWindow {
	id: string;
	title: string;
	icon: string;
	isOpen: boolean;
	isMinimized: boolean;
	isMaximized: boolean;
	zIndex: number;
	position: WindowPosition;
	size: WindowSize;
	componentKey: AppKey;
}

/** Registry is the single source of truth for app metadata and defaults. */
export const APP_REGISTRY = {
	radar: {
		title: "Hackathon Radar",
		icon: "radar",
		size: { width: 1040, height: 680 },
	},
	terminal: {
		title: "Terminal",
		icon: "terminal",
		size: { width: 720, height: 440 },
	},
	map: {
		title: "Hackamaps Explorer",
		icon: "map",
		size: { width: 900, height: 620 },
	},
	copilot: {
		title: "AI Hackathon Co-Pilot",
		icon: "sparkles",
		size: { width: 980, height: 720 },
	},
	help: {
		title: "Start Here",
		icon: "help",
		size: { width: 660, height: 560 },
	},
} as const;

export type AppKey = keyof typeof APP_REGISTRY;
const BASE_Z = 100;

export interface WindowManagerState {
	windows: DesktopWindow[];
	activeWindowId: string | null;
	radarQuery: string;
	savedHackathonIds: string[];
	pendingHackathonIdea: string | null;
	pendingCopilotHackathon: Hackathon | null;
	openWindow: (appKey: AppKey) => void;
	closeWindow: (id: string) => void;
	minimizeWindow: (id: string) => void;
	maximizeWindow: (id: string) => void;
	bringToFront: (id: string) => void;
	updatePosition: (id: string, position: WindowPosition) => void;
	updateSize: (id: string, size: WindowSize) => void;
	unfocusAll: () => void;
	minimizeAllWindows: () => void;
	setRadarQuery: (query: string) => void;
	toggleSavedHackathon: (id: string) => void;
	setPendingHackathonIdea: (context: string | null) => void;
	setPendingCopilotHackathon: (hackathon: Hackathon | null) => void;
}

/**
 * Reassigns compact ordered z values to every open, non-minimized window.
 * This prevents unbounded z-index growth while preserving relative stacking.
 */
function normalizeZOrder(
	windows: DesktopWindow[],
	focusedId?: string,
): DesktopWindow[] {
	const visible = windows.filter(
		(window) => window.isOpen && !window.isMinimized,
	);
	const ordered = visible
		.filter((window) => window.id !== focusedId)
		.sort((a, b) => a.zIndex - b.zIndex);
	const focused = visible.find((window) => window.id === focusedId);
	if (focused) ordered.push(focused);
	const zById = new Map(
		ordered.map((window, index) => [window.id, BASE_Z + index]),
	);
	return windows.map((window) => ({
		...window,
		zIndex: zById.get(window.id) ?? 0,
	}));
}

export const useWindowManager = create<WindowManagerState>((set) => ({
	windows: [],
	activeWindowId: null,
	radarQuery: "",
	savedHackathonIds: [],
	pendingHackathonIdea: null,
	pendingCopilotHackathon: null,

	openWindow: (appKey) =>
		set((state) => {
			const id = appKey;
			const existing = state.windows.find((window) => window.id === id);
			const restored = existing
				? state.windows.map((window) =>
						window.id === id
							? { ...window, isOpen: true, isMinimized: false }
							: window,
					)
				: (() => {
						const app = APP_REGISTRY[appKey];
						const offset = state.windows.length * 28;
						const next: DesktopWindow = {
							id,
							title: app.title,
							icon: app.icon,
							isOpen: true,
							isMinimized: false,
							isMaximized: false,
							zIndex: 0,
							position: { x: 80 + offset, y: 56 + offset },
							size: { ...app.size },
							componentKey: appKey,
						};
						return [...state.windows, next];
					})();
			return { windows: normalizeZOrder(restored, id), activeWindowId: id };
		}),

	closeWindow: (id) =>
		set((state) => {
			const windows = state.windows.filter((window) => window.id !== id);
			const nextActive =
				[...windows]
					.filter((window) => !window.isMinimized)
					.sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
			return {
				windows: normalizeZOrder(windows, nextActive ?? undefined),
				activeWindowId: nextActive,
			};
		}),

	minimizeWindow: (id) =>
		set((state) => {
			const windows = state.windows.map((window) =>
				window.id === id ? { ...window, isMinimized: true } : window,
			);
			const nextActive =
				windows
					.filter((window) => window.isOpen && !window.isMinimized)
					.sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
			return {
				windows: normalizeZOrder(windows, nextActive ?? undefined),
				activeWindowId: nextActive,
			};
		}),

	maximizeWindow: (id) =>
		set((state) => {
			const windows = state.windows.map((window) =>
				window.id === id
					? { ...window, isMaximized: !window.isMaximized, isMinimized: false }
					: window,
			);
			return { windows: normalizeZOrder(windows, id), activeWindowId: id };
		}),

	bringToFront: (id) =>
		set((state) => {
			if (!state.windows.some((window) => window.id === id && window.isOpen))
				return state;
			return {
				windows: normalizeZOrder(state.windows, id),
				activeWindowId: id,
			};
		}),

	updatePosition: (id, position) => {
		if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
		set((state) => ({
			windows: state.windows.map((window) =>
				window.id === id ? { ...window, position } : window,
			),
		}));
	},

	updateSize: (id, size) => {
		if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
		set((state) => ({
			windows: state.windows.map((window) =>
				window.id === id ? { ...window, size } : window,
			),
		}));
	},

	unfocusAll: () => set({ activeWindowId: null }),

	minimizeAllWindows: () =>
		set((state) => ({
			windows: normalizeZOrder(
				state.windows.map((window) => ({
					...window,
					isMinimized: window.isOpen,
				})),
			),
			activeWindowId: null,
		})),

	setRadarQuery: (query) => set({ radarQuery: query }),
	toggleSavedHackathon: (id) =>
		set((state) => ({
			savedHackathonIds: state.savedHackathonIds.includes(id)
				? state.savedHackathonIds.filter((savedId) => savedId !== id)
				: [...state.savedHackathonIds, id],
		})),
	setPendingHackathonIdea: (context) => set({ pendingHackathonIdea: context }),
	setPendingCopilotHackathon: (hackathon) =>
		set({ pendingCopilotHackathon: hackathon }),
}));

// Keep selectors outside components where possible to avoid unnecessary rerenders.
export const selectVisibleWindows = (
	state: WindowManagerState,
): DesktopWindow[] =>
	state.windows.filter((window) => window.isOpen && !window.isMinimized);

// Exposed for compact state restoration flows and future keyboard shortcuts.
export const focusWindow = (id: string): void =>
	useWindowManager.getState().bringToFront(id);
