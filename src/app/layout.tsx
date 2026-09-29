import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppearanceRoot } from "@/components/os/AppearanceRoot";

export const metadata: Metadata = {
	title: "Hack OS — DeScience Radar",
	description: "Discover hackathons and find your next team on Hack OS.",
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
