import { and, eq, gte, inArray, isNull, or, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { hackathons } from "@/db/schema";

export interface PublicEventStructuredData extends Record<string, unknown> {
	"@id": string;
}

function publicEventFilter(now: Date) {
	return and(
		eq(hackathons.published, true),
		eq(hackathons.verified, true),
		inArray(hackathons.applicationStatus, ["open", "upcoming"]),
		gte(hackathons.endDate, now),
		or(
			isNull(hackathons.registrationDeadline),
			gt(hackathons.registrationDeadline, now),
		),
	);
}

/** Returns only published, verified events; structured data never advertises drafts. */
export async function getPublicEventStructuredData(): Promise<
	PublicEventStructuredData[]
> {
	try {
		const now = new Date();
		const rows = await getDatabase()
			.select({
				slug: hackathons.slug,
				title: hackathons.title,
				description: hackathons.description,
				websiteUrl: hackathons.websiteUrl,
				format: hackathons.format,
				venueCity: hackathons.venueCity,
				venueCountry: hackathons.venueCountry,
				startDate: hackathons.startDate,
				endDate: hackathons.endDate,
				organizer: hackathons.organizer,
			})
			.from(hackathons)
			.where(publicEventFilter(now))
			.orderBy(hackathons.startDate)
			.limit(20);
		return rows.map((event) => ({
			"@context": "https://schema.org",
			"@type": "Event",
			"@id": `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/#event-${event.slug}`,
			name: event.title,
			description: event.description,
			startDate: event.startDate.toISOString(),
			endDate: event.endDate.toISOString(),
			eventStatus: "https://schema.org/EventScheduled",
			eventAttendanceMode:
				event.format === "online"
					? "https://schema.org/OnlineEventAttendanceMode"
					: event.format === "hybrid"
						? "https://schema.org/MixedEventAttendanceMode"
						: "https://schema.org/OfflineEventAttendanceMode",
			location:
				event.format === "online"
					? { "@type": "VirtualLocation", url: event.websiteUrl }
					: {
							"@type": "Place",
							name:
								[event.venueCity, event.venueCountry]
									.filter(Boolean)
									.join(", ") || event.organizer,
							address: {
								"@type": "PostalAddress",
								addressLocality: event.venueCity ?? undefined,
								addressCountry: event.venueCountry ?? undefined,
							},
						},
			organizer: { "@type": "Organization", name: event.organizer },
			url: event.websiteUrl,
		}));
	} catch {
		console.error("[seo] Unable to load public event structured data.");
		return [];
	}
}

/** Count used by the share image; failures degrade to zero without leaking details. */
export async function getPublicEventCount(): Promise<number> {
	try {
		const [result] = await getDatabase()
			.select({ count: sql<number>`count(*)::int` })
			.from(hackathons)
			.where(publicEventFilter(new Date()));
		return result?.count ?? 0;
	} catch {
		console.error("[seo] Unable to count public events for share image.");
		return 0;
	}
}
