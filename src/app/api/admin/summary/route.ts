import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import {
	MemberAccessError,
	requireAdminMember,
} from "@/lib/auth/requireVerifiedMember";
import { adminSummarySchema } from "@/schemas/adminSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Protected aggregates for the admin home; no student profile fields are returned. */
export async function GET(): Promise<Response> {
	const startedAt = Date.now();
	try {
		await requireAdminMember();
		const db = getDatabase();
		// One SQL round trip avoids opening seven concurrent reads for one dashboard.
		// Every result remains an aggregate; only the admin-only activity table returns
		// names/emails, and those are limited to the 25 most active linked members.
		const result = await db.execute(sql`
			WITH published_events AS MATERIALIZED (
				SELECT id, application_status, end_date, venue_city, venue_country, format
				FROM public.hackathons
				WHERE published = true AND verified = true
			),
			category_totals AS (
				SELECT tag.name, count(*)::integer AS total
				FROM public.hackathon_tag_links AS link
				JOIN public.hackathon_tags AS tag ON tag.id = link.tag_id
				JOIN published_events AS published_event
					ON published_event.id = link.hackathon_id
				GROUP BY tag.name
				ORDER BY total DESC, tag.name ASC
				LIMIT 12
			),
			location_totals AS (
				SELECT
					coalesce(
						nullif(concat_ws(', ', published_event.venue_city, published_event.venue_country), ''),
						CASE WHEN published_event.format = 'online' THEN 'Online' ELSE 'Location not listed' END
					) AS name,
					count(*)::integer AS total
				FROM published_events AS published_event
				GROUP BY 1
				ORDER BY total DESC, name ASC
				LIMIT 12
			),
			college_totals AS (
				SELECT college_name AS name, count(*)::integer AS total
				FROM public.club_members
				GROUP BY college_name
				ORDER BY total DESC, college_name ASC
				LIMIT 12
			),
			activity_totals AS (
				SELECT
					count(*) FILTER (WHERE activity = 'teammate_match')::integer AS teammate_matches,
					count(*) FILTER (WHERE activity = 'project_plan')::integer AS project_plans
				FROM public.member_activity_events
			),
			member_activity AS (
				SELECT
					member.auth_user_id AS user_id,
					member.full_name AS name,
					member.email,
					count(*) FILTER (WHERE activity.activity = 'teammate_match')::integer AS teammate_matches,
					count(*) FILTER (WHERE activity.activity = 'project_plan')::integer AS project_plans,
					to_char(
						max(activity.created_at) AT TIME ZONE 'UTC',
						'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
					) AS last_used_at
				FROM public.member_activity_events AS activity
				JOIN public.club_members AS member
					ON member.auth_user_id = activity.user_id
				GROUP BY member.auth_user_id, member.full_name, member.email
				ORDER BY count(*) DESC, member.full_name ASC
				LIMIT 25
			)
			SELECT jsonb_build_object(
				'events', (
					SELECT jsonb_build_object(
						'total', count(*)::integer,
						'upcoming', count(*) FILTER (
							WHERE application_status = 'upcoming' AND end_date >= now()
						)::integer,
						'open', count(*) FILTER (
							WHERE application_status = 'open' AND end_date >= now()
						)::integer,
						'closed', count(*) FILTER (
							WHERE application_status = 'closed' AND end_date >= now()
						)::integer,
						'ended', count(*) FILTER (
							WHERE application_status = 'ended' OR end_date < now()
						)::integer
					)
					FROM published_events
				),
				'categories', coalesce(
					(SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total)) FROM category_totals),
					'[]'::jsonb
				),
				'locations', coalesce(
					(SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total)) FROM location_totals),
					'[]'::jsonb
				),
				'colleges', coalesce(
					(SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total)) FROM college_totals),
					'[]'::jsonb
				),
				'members', (
					SELECT jsonb_build_object(
						'total', count(*)::integer,
						'verified', count(*) FILTER (WHERE verified_member)::integer,
						'current', count(*) FILTER (WHERE membership_status = 'current')::integer,
						'alumni', count(*) FILTER (WHERE membership_status = 'alumnus')::integer,
						'mentors', count(*) FILTER (WHERE membership_status = 'mentor')::integer
					)
					FROM public.club_members
				),
				'activity', jsonb_build_object(
					'teammateMatches', (SELECT teammate_matches FROM activity_totals),
					'projectPlans', (SELECT project_plans FROM activity_totals),
					'topMembers', coalesce(
						(
							SELECT jsonb_agg(jsonb_build_object(
								'userId', user_id,
								'name', name,
								'email', email,
								'teammateMatches', teammate_matches,
								'projectPlans', project_plans,
								'lastUsedAt', last_used_at
							) ORDER BY teammate_matches + project_plans DESC, name ASC)
							FROM member_activity
						),
						'[]'::jsonb
					)
				)
			) AS summary
		`);
		const row = result[0];
		const parsed = adminSummarySchema.safeParse(row?.summary);
		if (!parsed.success) {
			console.error(
				"[admin-summary] Summary result failed schema validation.",
				{
					issueCount: parsed.error.issues.length,
				},
			);
			return NextResponse.json(
				{ error: "Admin summary is temporarily unavailable." },
				{ status: 503, headers: { "Cache-Control": "no-store" } },
			);
		}
		console.info("[admin-summary] Summary loaded.", {
			durationMs: Date.now() - startedAt,
		});
		return NextResponse.json(parsed.data, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error: unknown) {
		if (error instanceof MemberAccessError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status, headers: { "Cache-Control": "no-store" } },
			);
		const diagnostic =
			error instanceof Error
				? {
						name: error.name,
						code:
							typeof error === "object" &&
							"code" in error &&
							typeof error.code === "string"
								? error.code
								: undefined,
						message: error.message
							.replace(
								/postgres(?:ql)?:\/\/[^\s]+/gi,
								"[database URL redacted]",
							)
							.slice(0, 300),
					}
				: { name: "UnknownError" };
		console.error("[admin-summary] Summary query failed.", {
			...diagnostic,
			durationMs: Date.now() - startedAt,
		});
		return NextResponse.json(
			{ error: "Admin summary is temporarily unavailable." },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		);
	}
}
