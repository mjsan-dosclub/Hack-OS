"use client";

import type { ReactNode } from "react";
import { useDesktopAppearance } from "@/hooks/useDesktopAppearance";

/** Hydrates saved appearance preferences for desktop, admin, and auth routes. */
export function AppearanceRoot({ children }: { children: ReactNode }) {
	useDesktopAppearance();
	return children;
}
