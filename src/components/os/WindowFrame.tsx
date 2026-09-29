"use client";

import {
	useEffect,
	useRef,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
} from "react";
import {
	motion,
	useDragControls,
	useMotionValue,
	type PanInfo,
} from "framer-motion";
import {
	BookOpen,
	Map as MapIcon,
	Maximize2,
	Minus,
	Radar,
	Sparkles,
	Terminal,
	X,
	type LucideIcon,
} from "lucide-react";
import type {
	AppKey,
	DesktopWindow,
	WindowPosition,
	WindowSize,
} from "@/stores/useWindowManager";

interface WindowFrameProps {
	window: DesktopWindow;
	active: boolean;
	desktopBoundsRef: RefObject<HTMLDivElement | null>;
	onFocus: () => void;
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
	onMove: (position: WindowPosition) => void;
	onResize: (size: WindowSize) => void;
	children: React.ReactNode;
}

type ResizeOrigin = {
	pointerX: number;
	pointerY: number;
	width: number;
	height: number;
};
const WINDOW_ICONS: Record<AppKey, LucideIcon> = {
	radar: Radar,
	terminal: Terminal,
	map: MapIcon,
	copilot: Sparkles,
	help: BookOpen,
};

export function WindowFrame({
	window: item,
	active,
	desktopBoundsRef,
	onFocus,
	onClose,
	onMinimize,
	onMaximize,
	onMove,
	onResize,
	children,
}: WindowFrameProps) {
	const dragControls = useDragControls();
	const dragX = useMotionValue(0);
	const dragY = useMotionValue(0);
	const resizeOrigin = useRef<ResizeOrigin | null>(null);
	const AppIcon = WINDOW_ICONS[item.componentKey];

	useEffect(() => {
		function moveResize(event: PointerEvent) {
			const origin = resizeOrigin.current;
			const bounds = desktopBoundsRef.current?.getBoundingClientRect();
			if (!origin || !bounds) return;
			const maxWidth = Math.max(360, bounds.width - item.position.x - 12);
			const maxHeight = Math.max(240, bounds.height - item.position.y - 12);
			onResize({
				width: Math.min(
					maxWidth,
					Math.max(360, origin.width + event.clientX - origin.pointerX),
				),
				height: Math.min(
					maxHeight,
					Math.max(240, origin.height + event.clientY - origin.pointerY),
				),
			});
		}
		function finishResize() {
			resizeOrigin.current = null;
		}
		window.addEventListener("pointermove", moveResize);
		window.addEventListener("pointerup", finishResize);
		window.addEventListener("pointercancel", finishResize);
		return () => {
			window.removeEventListener("pointermove", moveResize);
			window.removeEventListener("pointerup", finishResize);
			window.removeEventListener("pointercancel", finishResize);
		};
	}, [desktopBoundsRef, item.position.x, item.position.y, onResize]);

	function startDrag(event: ReactPointerEvent<HTMLElement>) {
		if (
			item.isMaximized ||
			(event.target instanceof HTMLElement && event.target.closest("button"))
		)
			return;
		onFocus();
		dragControls.start(event);
	}

	function finishDrag(
		_event: MouseEvent | TouchEvent | PointerEvent,
		info: PanInfo,
	) {
		const bounds = desktopBoundsRef.current?.getBoundingClientRect();
		if (!bounds || item.isMaximized) return;
		const candidateX = item.position.x + info.offset.x;
		const candidateY = item.position.y + info.offset.y;
		if (candidateY < 18) {
			onMaximize();
			dragX.set(0);
			dragY.set(0);
			return;
		}
		const rightEdge = candidateX + item.size.width;
		const snappedX =
			candidateX < 20
				? 12
				: rightEdge > bounds.width - 20
					? Math.max(12, bounds.width - item.size.width - 12)
					: candidateX;
		const maxY = Math.max(12, bounds.height - item.size.height - 12);
		onMove({
			x: Math.max(12, Math.min(snappedX, Math.max(12, bounds.width - 48))),
			y: Math.max(12, Math.min(candidateY, maxY)),
		});
		dragX.set(0);
		dragY.set(0);
	}

	function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		onFocus();
		resizeOrigin.current = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			width: item.size.width,
			height: item.size.height,
		};
	}

	function resizeWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
		const bounds = desktopBoundsRef.current?.getBoundingClientRect();
		if (!bounds) return;
		const step = event.shiftKey ? 40 : 16;
		const widthDelta =
			event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
		const heightDelta =
			event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
		if (widthDelta === 0 && heightDelta === 0) return;
		event.preventDefault();
		onResize({
			width: Math.min(
				Math.max(360, bounds.width - item.position.x - 12),
				Math.max(360, item.size.width + widthDelta),
			),
			height: Math.min(
				Math.max(240, bounds.height - item.position.y - 12),
				Math.max(240, item.size.height + heightDelta),
			),
		});
	}

	function handleHeaderKeyDown(event: React.KeyboardEvent<HTMLElement>) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onFocus();
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			onMove({ x: Math.max(12, item.position.x - 20), y: item.position.y });
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			onMove({ x: item.position.x + 20, y: item.position.y });
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			onMove({ x: item.position.x, y: Math.max(12, item.position.y - 20) });
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			onMove({ x: item.position.x, y: item.position.y + 20 });
		}
	}

	const availableWidth = `max(0px, calc(100% - ${Math.max(0, item.position.x)}px - 24px))`;
	const availableHeight = `max(0px, calc(100% - ${Math.max(0, item.position.y)}px - 24px))`;
	const geometryStyle = item.isMaximized
		? { inset: 12, zIndex: item.zIndex }
		: {
				left: item.position.x,
				top: item.position.y,
				width: `min(${item.size.width}px, ${availableWidth})`,
				height: `min(${item.size.height}px, ${availableHeight})`,
				maxWidth: availableWidth,
				maxHeight: availableHeight,
				zIndex: item.zIndex,
				x: dragX,
				y: dragY,
			};

	return (
		<motion.section
			layout
			layoutId={`${item.id}-shared-window`}
			drag={!item.isMaximized}
			dragListener={false}
			dragControls={dragControls}
			dragConstraints={desktopBoundsRef}
			dragElastic={0.06}
			dragMomentum={false}
			onDragEnd={finishDrag}
			onPointerDown={onFocus}
			initial={{ opacity: 0, scale: 0.96, y: 10 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0.3, scale: 0.3, transition: { duration: 0.2 } }}
			transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.75 }}
			aria-label={`${item.title} window`}
			className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-[#171a23]/90 shadow-2xl shadow-black/40 backdrop-blur-2xl ${active ? "border-cyan-200/50 ring-1 ring-cyan-100/10" : "border-white/15"} ${item.isMaximized ? "!bottom-3 !left-3 !right-3 !top-3 !h-auto !w-auto" : ""}`}
			style={geometryStyle}
		>
			<header
				role="toolbar"
				aria-label={`${item.title} window title bar`}
				tabIndex={0}
				onPointerDown={startDrag}
				onDoubleClick={(event) => {
					if (
						!(
							event.target instanceof HTMLElement &&
							event.target.closest("button")
						)
					)
						onMaximize();
				}}
				onKeyDown={handleHeaderKeyDown}
				className="flex h-11 shrink-0 cursor-grab select-none items-center gap-3 border-b border-white/10 bg-white/[0.035] px-3 outline-none active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-100/50"
			>
				<fieldset className="flex items-center gap-1.5">
					<legend className="sr-only">Window controls</legend>
					<button
						type="button"
						aria-label={`Close ${item.title}`}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={onClose}
						className="grid size-3.5 place-items-center rounded-full bg-[#ff6259] text-[#651a18] shadow-inner"
					>
						<X className="size-2 opacity-0 transition-opacity hover:opacity-100" />
					</button>
					<button
						type="button"
						aria-label={`Minimize ${item.title}`}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={onMinimize}
						className="grid size-3.5 place-items-center rounded-full bg-[#febc2e] text-[#684900] shadow-inner"
					>
						<Minus className="size-2 opacity-0 transition-opacity hover:opacity-100" />
					</button>
					<button
						type="button"
						aria-label={`${item.isMaximized ? "Restore" : "Maximize"} ${item.title}`}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={onMaximize}
						className="grid size-3.5 place-items-center rounded-full bg-[#28c840] text-[#075e1a] shadow-inner"
					>
						<Maximize2 className="size-2 opacity-0 transition-opacity hover:opacity-100" />
					</button>
				</fieldset>
				<span className="flex min-w-0 flex-1 items-center justify-center gap-2 text-xs font-medium text-white/75">
					<AppIcon className="size-3.5 shrink-0 text-cyan-100/75" />
					<span className="truncate">{item.title}</span>
				</span>
				<span className="w-[48px] shrink-0" />
			</header>
			<div className="min-h-0 flex-1 overflow-auto overscroll-contain">
				{children}
			</div>
			{!item.isMaximized && (
				<button
					type="button"
					onPointerDown={startResize}
					onKeyDown={resizeWithKeyboard}
					aria-label={`Resize ${item.title} window; use arrow keys`}
					className="absolute bottom-0 right-0 grid size-5 cursor-nwse-resize touch-none place-items-center rounded-none bg-transparent before:absolute before:bottom-1.5 before:right-1.5 before:size-2 before:border-b before:border-r before:border-white/45 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-100/60"
				/>
			)}
		</motion.section>
	);
}
