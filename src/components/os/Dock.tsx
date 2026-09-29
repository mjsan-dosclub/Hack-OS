"use client";

import { useRef } from "react";
import {
	motion,
	useMotionValue,
	useSpring,
	useTransform,
	type MotionValue,
} from "framer-motion";
import {
	BookOpen,
	Bot,
	Command,
	Map as MapIcon,
	Radar,
	Terminal,
	Globe2,
} from "lucide-react";
import {
	APP_REGISTRY,
	useWindowManager,
	type AppKey,
} from "@/stores/useWindowManager";
import type { LucideIcon } from "lucide-react";

interface DockProps {
	onOpenPalette: () => void;
}

const APPLICATIONS = [
	{ id: "help", Icon: BookOpen },
	{ id: "radar", Icon: Radar },
	{ id: "terminal", Icon: Terminal },
	{ id: "map", Icon: MapIcon },
	{ id: "copilot", Icon: Bot },
] as const satisfies readonly { id: AppKey; Icon: LucideIcon }[];

const CLUB_URL = "https://descienceosclub.com/";

function DockApplication({
	appKey,
	Icon,
	pointerX,
	onOpen,
}: {
	appKey: AppKey;
	Icon: LucideIcon;
	pointerX: MotionValue<number>;
	onOpen: (appKey: AppKey) => void;
}) {
	const elementRef = useRef<HTMLButtonElement>(null);
	const scaleInput = useTransform(pointerX, (pointer) => {
		const element = elementRef.current;
		if (!element) return 1;
		const center = element.offsetLeft + element.offsetWidth / 2;
		const proximity = Math.max(0, 1 - Math.abs(pointer - center) / 110);
		return 1 + proximity * 0.5;
	});
	const scale = useSpring(scaleInput, {
		stiffness: 300,
		damping: 25,
		mass: 0.3,
	});
	const y = useTransform(scale, [1, 1.5], [0, -9]);
	const app = APP_REGISTRY[appKey];
	const running = useWindowManager((state) =>
		state.windows.some((item) => item.id === appKey && item.isOpen),
	);

	return (
		<motion.button
			ref={elementRef}
			layoutId={`${appKey}-shared-window`}
			style={{ scale, y }}
			onClick={() => onOpen(appKey)}
			aria-label={`${running ? "Focus or restore" : "Open"} ${app.title}`}
			title={app.title}
			className="group relative grid size-8 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.035] text-white/80 shadow-lg shadow-black/25 outline-none transition-colors hover:border-cyan-100/30 hover:text-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-200 sm:size-10 sm:rounded-[15px] lg:size-[52px]"
		>
			<Icon className="size-4 sm:size-5 lg:size-[22px]" strokeWidth={1.7} />
			<span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#1b1e28] px-2 py-1 text-[10px] text-white/75 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
				{app.title}
			</span>
			{running && (
				<span
					role="status"
					aria-label="Application running"
					className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_8px_rgba(103,232,249,0.8)]"
				/>
			)}
		</motion.button>
	);
}

export function Dock({ onOpenPalette }: DockProps) {
	const dockRef = useRef<HTMLElement>(null);
	const pointerX = useMotionValue(-1000);
	const openWindow = useWindowManager((state) => state.openWindow);

	return (
		<nav
			ref={dockRef}
			aria-label="Application Dock"
			onMouseMove={(event) =>
				pointerX.set(
					event.clientX - event.currentTarget.getBoundingClientRect().left,
				)
			}
			onMouseLeave={() => pointerX.set(-1000)}
			onFocus={() => pointerX.set(-1000)}
			className="absolute bottom-3 left-1/2 z-[700] flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-end gap-1 rounded-[18px] border border-white/[0.16] bg-[#191c26]/75 p-1.5 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:gap-1.5 sm:p-2 lg:gap-2 lg:p-2.5"
		>
			{APPLICATIONS.map(({ id, Icon }) => (
				<DockApplication
					key={id}
					appKey={id}
					Icon={Icon}
					pointerX={pointerX}
					onOpen={openWindow}
				/>
			))}
			<span
				aria-hidden="true"
				className="mx-0.5 mb-1.5 h-8 w-px shrink-0 bg-white/15"
			/>
			<a
				href={CLUB_URL}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Visit DeScience Open Source Club"
				title="DeScience Open Source Club"
				className="grid size-8 shrink-0 place-items-center rounded-[13px] border border-violet-200/15 bg-violet-300/[0.09] text-violet-100/80 transition hover:-translate-y-1 hover:bg-violet-200/15 sm:size-10 sm:rounded-[15px] lg:size-[52px]"
			>
				<Globe2 className="size-4 sm:size-5" />
			</a>
			<span
				aria-hidden="true"
				className="mx-0.5 mb-1.5 h-8 w-px shrink-0 bg-white/15"
			/>
			<button
				type="button"
				onClick={onOpenPalette}
				aria-label="Open Command Palette"
				title="Spotlight · ⌘K"
				className="grid size-8 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10 hover:text-white sm:size-10 sm:rounded-[15px] lg:size-[52px]"
			>
				<Command className="size-4 sm:size-5" />
			</button>
		</nav>
	);
}
