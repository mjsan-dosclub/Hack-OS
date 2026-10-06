"use client";

import { useEffect, useState } from "react";

export const DESKTOP_THEMES = ["midnight", "aurora", "ember", "light"] as const;
export type DesktopTheme = (typeof DESKTOP_THEMES)[number];
export const DESKTOP_FONT_SIZES = ["standard", "large", "largest"] as const;
export type DesktopFontSize = (typeof DESKTOP_FONT_SIZES)[number];
export const DESKTOP_FONT_FAMILIES = ["system", "arial"] as const;
export type DesktopFontFamily = (typeof DESKTOP_FONT_FAMILIES)[number];

interface AppearanceSettings {
	theme: DesktopTheme;
	fontSize: DesktopFontSize;
	fontFamily: DesktopFontFamily;
}

const STORAGE_KEY = "hack-os:appearance:v1";
const DEFAULT_SETTINGS: AppearanceSettings = {
	theme: "light",
	fontSize: "standard",
	fontFamily: "system",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
	value: unknown,
	choices: readonly T[],
): value is T {
	return (
		typeof value === "string" && choices.some((choice) => choice === value)
	);
}

function parseAppearance(value: unknown): AppearanceSettings {
	if (!isRecord(value)) return DEFAULT_SETTINGS;
	return {
		theme: isOneOf(value.theme, DESKTOP_THEMES)
			? value.theme
			: DEFAULT_SETTINGS.theme,
		fontSize: isOneOf(value.fontSize, DESKTOP_FONT_SIZES)
			? value.fontSize
			: DEFAULT_SETTINGS.fontSize,
		fontFamily: isOneOf(value.fontFamily, DESKTOP_FONT_FAMILIES)
			? value.fontFamily
			: DEFAULT_SETTINGS.fontFamily,
	};
}

/** Stores visual preferences independently from runtime window state. */
export function useDesktopAppearance() {
	const [settings, setSettings] =
		useState<AppearanceSettings>(DEFAULT_SETTINGS);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored) setSettings(parseAppearance(JSON.parse(stored) as unknown));
		} catch {
			// Defaults remain usable when storage is unavailable or malformed.
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		document.documentElement.dataset.osFont = settings.fontSize;
		document.documentElement.dataset.osFontFace = settings.fontFamily;
		document.documentElement.dataset.osTheme = settings.theme;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// Preferences still apply for this session when storage is unavailable.
		}
	}, [hydrated, settings]);

	function setTheme(theme: DesktopTheme) {
		setSettings((current) => ({ ...current, theme }));
	}
	function setFontSize(fontSize: DesktopFontSize) {
		setSettings((current) => ({ ...current, fontSize }));
	}
	function setFontFamily(fontFamily: DesktopFontFamily) {
		setSettings((current) => ({ ...current, fontFamily }));
	}
	function cycleTheme() {
		setSettings((current) => {
			const index = DESKTOP_THEMES.indexOf(current.theme);
			return {
				...current,
				theme: DESKTOP_THEMES[(index + 1) % DESKTOP_THEMES.length],
			};
		});
	}

	return { ...settings, setTheme, setFontSize, setFontFamily, cycleTheme };
}
