import { ImageResponse } from "next/og";
import { z } from "zod";

export const alt = "Hack OS — DeScience Radar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const publicEventsResponseSchema = z.object({
	events: z.array(
		z.object({ id: z.string(), title: z.string() }).passthrough(),
	),
});

async function getLiveCount(): Promise<number | null> {
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
	if (!siteUrl) return null;
	try {
		const response = await fetch(new URL("/api/hackathons", siteUrl), {
			next: { revalidate: 300 },
		});
		if (!response.ok) return null;
		const parsed = publicEventsResponseSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.events.length : null;
	} catch {
		return null;
	}
}

export default async function OpenGraphImage() {
	const count = await getLiveCount();
	return new ImageResponse(
		<div
			style={{
				display: "flex",
				width: "100%",
				height: "100%",
				padding: 54,
				background:
					"linear-gradient(135deg, #07111d 0%, #102d3a 52%, #151826 100%)",
				color: "#f3f7fb",
				fontFamily: "sans-serif",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					border: "1px solid #52727e",
					borderRadius: 28,
					padding: 38,
					background: "rgba(9, 15, 25, 0.82)",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						color: "#8cebf3",
						fontSize: 19,
						fontWeight: 700,
						letterSpacing: 5,
					}}
				>
					DESCIENCE OPEN SOURCE CLUB
				</div>
				<div
					style={{
						display: "flex",
						marginTop: 26,
						fontSize: 64,
						fontWeight: 700,
						letterSpacing: -3,
					}}
				>
					Hack OS
				</div>
				<div
					style={{
						display: "flex",
						marginTop: 8,
						color: "#b8c9d4",
						fontSize: 28,
					}}
				>
					Find your next hackathon. Build with your people.
				</div>
				<div
					style={{
						display: "flex",
						flex: 1,
						alignItems: "center",
						marginTop: 35,
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							width: "68%",
							height: 218,
							border: "1px solid #3d5966",
							borderRadius: 18,
							background: "#111923",
							padding: 22,
						}}
					>
						<div
							style={{
								display: "flex",
								color: "#8cebf3",
								fontSize: 16,
								letterSpacing: 3,
							}}
						>
							DESCIENCE RADAR
						</div>
						<div
							style={{
								display: "flex",
								marginTop: 15,
								color: "#edf4f7",
								fontSize: 27,
								fontWeight: 700,
							}}
						>
							Reviewed opportunities
						</div>
						<div
							style={{
								display: "flex",
								marginTop: 10,
								color: "#f6d98e",
								fontSize: 42,
								fontWeight: 700,
							}}
						>
							{count === null ? "Live directory" : `${count} upcoming events`}
						</div>
						<div
							style={{
								display: "flex",
								marginTop: 8,
								color: "#a9bbc6",
								fontSize: 17,
							}}
						>
							Discovery, team matching, and a member workspace.
						</div>
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							marginLeft: 24,
							width: "28%",
							height: 218,
							border: "1px solid #3d5966",
							borderRadius: 18,
							background: "#161c29",
							padding: 20,
							justifyContent: "center",
						}}
					>
						<div style={{ display: "flex", fontSize: 52 }}>OS</div>
						<div
							style={{
								display: "flex",
								marginTop: 15,
								color: "#8cebf3",
								fontSize: 19,
								fontWeight: 700,
							}}
						>
							STUDENT BUILT
						</div>
						<div
							style={{
								display: "flex",
								marginTop: 9,
								color: "#b8c9d4",
								fontSize: 17,
							}}
						>
							Open-source club systems
						</div>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						marginTop: 22,
						color: "#8cebf3",
						fontSize: 17,
					}}
				>
					radar.descienceosclub.com
				</div>
			</div>
		</div>,
		{
			...size,
			headers: {
				"Cache-Control":
					"public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
			},
		},
	);
}
