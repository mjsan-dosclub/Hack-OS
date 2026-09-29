import { NextResponse } from "next/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import {
	clubMembers,
	hackathonTagLinks,
	hackathonTags,
	hackathons,
	memberActivityEvents,
} from "@/db/schema";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Protected aggregates for the admin home; no student profile fields are returned. */
export async function GET(): Promise<Response> {
	try {
		await requireAdminMember();
		const db = getDatabase();
		const [events, eventCategories, locations, roster, colleges, usage, users] =
			await Promise.all([
				db
					.select({
						id: hackathons.id,
						status: hackathons.applicationStatus,
						endDate: hackathons.endDate,
					})
					.from(hackathons)
					.where(
						and(eq(hackathons.published, true), eq(hackathons.verified, true)),
					),
				db
					.select({ category: hackathonTags.name, total: count() })
					.from(hackathonTagLinks)
					.innerJoin(
						hackathonTags,
						eq(hackathonTags.id, hackathonTagLinks.tagId),
					)
					.innerJoin(
						hackathons,
						eq(hackathons.id, hackathonTagLinks.hackathonId),
					)
					.where(
						and(eq(hackathons.published, true), eq(hackathons.verified, true)),
					)
					.groupBy(hackathonTags.name)
					.orderBy(desc(count()))
					.limit(12),
				db
					.select({
						city: hackathons.venueCity,
						country: hackathons.venueCountry,
						format: hackathons.format,
						total: count(),
					})
					.from(hackathons)
					.where(
						and(eq(hackathons.published, true), eq(hackathons.verified, true)),
					)
					.groupBy(
						hackathons.venueCity,
						hackathons.venueCountry,
						hackathons.format,
					)
					.orderBy(desc(count()))
					.limit(12),
				db
					.select({
						total: count(),
						verified: sql<number>`count(*) filter (where ${clubMembers.verifiedMember})`,
						current: sql<number>`count(*) filter (where ${clubMembers.membershipStatus} = 'current')`,
						alumni: sql<number>`count(*) filter (where ${clubMembers.membershipStatus} = 'alumnus')`,
						mentors: sql<number>`count(*) filter (where ${clubMembers.membershipStatus} = 'mentor')`,
					})
					.from(clubMembers),
				db
					.select({ name: clubMembers.collegeName, total: count() })
					.from(clubMembers)
					.groupBy(clubMembers.collegeName)
					.orderBy(desc(count()))
					.limit(12),
				db
					.select({
						activity: memberActivityEvents.activity,
						total: count(),
					})
					.from(memberActivityEvents)
					.groupBy(memberActivityEvents.activity),
				db
					.select({
						userId: memberActivityEvents.userId,
						activity: memberActivityEvents.activity,
						uses: count(),
						lastUsedAt: sql<Date>`max(${memberActivityEvents.createdAt})`,
						name: clubMembers.fullName,
						email: clubMembers.email,
					})
					.from(memberActivityEvents)
					.innerJoin(
						clubMembers,
						eq(clubMembers.authUserId, memberActivityEvents.userId),
					)
					.groupBy(
						memberActivityEvents.userId,
						memberActivityEvents.activity,
						clubMembers.fullName,
						clubMembers.email,
					)
					.orderBy(desc(count()))
					.limit(100),
			]);

		const now = Date.now();
		const eventSummary = {
			total: events.length,
			upcoming: events.filter(
				(event) =>
					event.status === "upcoming" && event.endDate.getTime() >= now,
			).length,
			open: events.filter(
				(event) => event.status === "open" && event.endDate.getTime() >= now,
			).length,
			closed: events.filter(
				(event) => event.status === "closed" && event.endDate.getTime() >= now,
			).length,
			ended: events.filter(
				(event) => event.status === "ended" || event.endDate.getTime() < now,
			).length,
		};
		return NextResponse.json(
			{
				events: eventSummary,
				categories: eventCategories.map((row) => ({
					name: row.category,
					total: Number(row.total),
				})),
				locations: locations.map((row) => ({
					name:
						[row.city, row.country].filter(Boolean).join(", ") ||
						(row.format === "online" ? "Online" : "Location not listed"),
					total: Number(row.total),
				})),
				colleges: colleges.map((row) => ({
					name: row.name,
					total: Number(row.total),
				})),
				members: {
					total: Number(roster[0]?.total ?? 0),
					verified: Number(roster[0]?.verified ?? 0),
					current: Number(roster[0]?.current ?? 0),
					alumni: Number(roster[0]?.alumni ?? 0),
					mentors: Number(roster[0]?.mentors ?? 0),
				},
				activity: {
					teammateMatches: Number(
						usage.find((row) => row.activity === "teammate_match")?.total ?? 0,
					),
					projectPlans: Number(
						usage.find((row) => row.activity === "project_plan")?.total ?? 0,
					),
					topMembers: users
						.reduce<
							Array<{
								userId: string;
								name: string;
								email: string;
								teammateMatches: number;
								projectPlans: number;
								lastUsedAt: string | null;
							}>
						>((rows, row) => {
							let item = rows.find(
								(candidate) => candidate.userId === row.userId,
							);
							if (!item) {
								item = {
									userId: row.userId,
									name: row.name,
									email: row.email,
									teammateMatches: 0,
									projectPlans: 0,
									lastUsedAt: null,
								};
								rows.push(item);
							}
							if (row.activity === "teammate_match")
								item.teammateMatches = Number(row.uses);
							else item.projectPlans = Number(row.uses);
							if (
								!item.lastUsedAt ||
								row.lastUsedAt.getTime() > Date.parse(item.lastUsedAt)
							)
								item.lastUsedAt = row.lastUsedAt.toISOString();
							return rows;
						}, [])
						.sort(
							(left, right) =>
								right.teammateMatches +
								right.projectPlans -
								(left.teammateMatches + left.projectPlans),
						)
						.slice(0, 25),
				},
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error: unknown) {
		if (error instanceof MemberAccessError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		console.error("[admin-summary] Summary query failed.");
		return NextResponse.json(
			{ error: "Admin summary is temporarily unavailable." },
			{ status: 500 },
		);
	}
}
