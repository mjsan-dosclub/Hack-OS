import { Desktop } from "@/components/os/Desktop";
import { getPublicEventStructuredData } from "@/lib/seo/publicStructuredData";

export const dynamic = "force-dynamic";

function safeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function HomePage() {
	const events = await getPublicEventStructuredData();
	const software = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Hack OS — DeScience Radar",
		applicationCategory: "EducationalApplication",
		operatingSystem: "Web",
		description:
			"A DeScience Open Source Club member workspace and reviewed hackathon discovery system.",
		url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
		publisher: {
			"@type": "Organization",
			name: "DeScience Open Source Club",
			url: "https://descienceosclub.com",
		},
	};
	return (
		<>
			<script type="application/ld+json">{safeJsonLd(software)}</script>
			{events.map((event) => (
				<script key={event["@id"]} type="application/ld+json">
					{safeJsonLd(event)}
				</script>
			))}
			<Desktop />
		</>
	);
}
