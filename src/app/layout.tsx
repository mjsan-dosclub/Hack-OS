import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppearanceRoot } from "@/components/os/AppearanceRoot";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: "Hack OS — DeScience Radar",
	description: "Discover hackathons and find your next team on Hack OS.",
	openGraph: {
		type: "website",
		siteName: "Hack OS — DeScience Open Source Club",
		title: "Hack OS — DeScience Radar",
		description: "Discover reviewed hackathons and find your next team.",
		url: "/",
		images: [
			{
				url: "/opengraph-image",
				width: 1200,
				height: 630,
				alt: "Hack OS desktop and hackathon radar",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Hack OS — DeScience Radar",
		description: "Discover reviewed hackathons and find your next team.",
		images: ["/opengraph-image"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				<AppearanceRoot>{children}</AppearanceRoot>
			</body>
		</html>
	);
}
