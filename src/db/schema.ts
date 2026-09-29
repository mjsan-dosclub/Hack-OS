import {
	boolean,
	check,
	date,
	doublePrecision,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Keep enum members aligned with the public Zod schemas in schemas/hackathon.ts
// and the separately managed RLS migration.
export const hackathonFormatEnum = pgEnum("hackathon_format", [
	"online",
	"in-person",
	"hybrid",
]);
export const applicationStatusEnum = pgEnum("application_status", [
	"upcoming",
	"open",
	"closed",
	"ended",
]);
export const hackathonSourceEnum = pgEnum("hackathon_source", [
	"devpost",
	"devfolio",
	"unstop",
	"manual",
	"mlh",
]);
export const userRoleEnum = pgEnum("user_role", [
	"member",
	"moderator",
	"admin",
]);
export const verificationProviderEnum = pgEnum("verification_provider", [
	"hackodds",
	"hackathonradar",
	"hackclub",
	"hackamaps",
]);
export const sourceCheckStatusEnum = pgEnum("source_check_status", [
	"confirmed",
	"conflict",
	"unmatched",
]);
export const clubMembershipStatusEnum = pgEnum("club_membership_status", [
	"current",
	"alumnus",
	"mentor",
	"guest",
]);
export const travelFlexibilityEnum = pgEnum("travel_flexibility", [
	"remote_only",
	"regional",
	"anywhere",
]);
export const studentRequestStatusEnum = pgEnum("student_request_status", [
	"open",
	"matched",
	"completed",
]);
export const memberLibraryProcessingStatusEnum = pgEnum(
	"member_library_processing_status",
	["ready", "failed"],
);
export const memberActivityTypeEnum = pgEnum("member_activity_type", [
	"teammate_match",
	"project_plan",
]);

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
};

/** One profile per Supabase Auth user. The auth user is the identity authority. */
export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey(),
		displayName: varchar("display_name", { length: 100 }),
		githubUsername: varchar("github_username", { length: 39 }),
		skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
		bio: varchar("bio", { length: 500 }),
		university: varchar("university", { length: 180 }),
		socialLinks: text("social_links")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		role: userRoleEnum("role").notNull().default("member"),
		...timestamps,
	},
	(table) => [
		uniqueIndex("users_github_username_uq").on(
			sql`lower(${table.githubUsername})`,
		),
		index("users_university_idx").on(table.university),
	],
);

/** Canonical directory record. Coordinates use decimal degrees (WGS84). */
export const hackathons = pgTable(
	"hackathons",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: varchar("slug", { length: 180 }).notNull(),
		title: varchar("title", { length: 240 }).notNull(),
		description: text("description").notNull().default(""),
		eligibilityRules: text("eligibility_rules")
			.notNull()
			.default("Eligibility details have not been published."),
		submissionGuidelines: text("submission_guidelines")
			.notNull()
			.default("Check the official event page for submission requirements."),
		organizer: varchar("organizer", { length: 180 }).notNull(),
		websiteUrl: text("website_url").notNull(),
		bannerUrl: text("banner_url"),
		format: hackathonFormatEnum("format").notNull(),
		venueCity: varchar("venue_city", { length: 120 }),
		venueCountry: varchar("venue_country", { length: 120 }),
		latitude: doublePrecision("latitude"),
		longitude: doublePrecision("longitude"),
		prizeCurrency: varchar("prize_currency", { length: 3 })
			.notNull()
			.default("USD"),
		totalPrizeValue: integer("total_prize_value").notNull().default(0),
		startDate: timestamp("start_date", { withTimezone: true }).notNull(),
		endDate: timestamp("end_date", { withTimezone: true }).notNull(),
		registrationDeadline: timestamp("registration_deadline", {
			withTimezone: true,
		}),
		applicationStatus: applicationStatusEnum("application_status")
			.notNull()
			.default("upcoming"),
		source: hackathonSourceEnum("source").notNull(),
		sourceId: varchar("source_id", { length: 240 }),
		verified: boolean("verified").notNull().default(false),
		published: boolean("published").notNull().default(false),
		...timestamps,
	},
	(table) => [
		uniqueIndex("hackathons_slug_uq").on(table.slug),
		uniqueIndex("hackathons_source_source_id_uq").on(
			table.source,
			table.sourceId,
		),
		index("hackathons_deadline_idx").on(table.registrationDeadline),
		index("hackathons_dates_idx").on(table.startDate, table.endDate),
		index("hackathons_location_idx").on(table.latitude, table.longitude),
		index("hackathons_public_status_idx").on(
			table.published,
			table.verified,
			table.applicationStatus,
		),
		// The GIN expression index is also declared in the SQL migration because
		// generated tsvector indexes are most portable and explicit as SQL.
		check(
			"hackathons_coordinates_pair_ck",
			sql`(${table.latitude} is null) = (${table.longitude} is null)`,
		),
		check(
			"hackathons_latitude_ck",
			sql`${table.latitude} is null or (${table.latitude} between -90 and 90)`,
		),
		check(
			"hackathons_longitude_ck",
			sql`${table.longitude} is null or (${table.longitude} between -180 and 180)`,
		),
		check(
			"hackathons_dates_order_ck",
			sql`${table.endDate} >= ${table.startDate}`,
		),
		check(
			"hackathons_prize_nonnegative_ck",
			sql`${table.totalPrizeValue} >= 0`,
		),
	],
);

export const hackathonTracks = pgTable(
	"hackathon_tracks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		hackathonId: uuid("hackathon_id")
			.notNull()
			.references(() => hackathons.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 180 }).notNull(),
		description: text("description").notNull().default(""),
		prizeAmount: integer("prize_amount").notNull().default(0),
		...timestamps,
	},
	(table) => [
		index("hackathon_tracks_hackathon_idx").on(table.hackathonId),
		check(
			"hackathon_tracks_prize_nonnegative_ck",
			sql`${table.prizeAmount} >= 0`,
		),
	],
);

/** Normalized tag catalog. Slugs are stable keys; labels are presentation. */
export const hackathonTags = pgTable(
	"hackathon_tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: varchar("slug", { length: 64 }).notNull(),
		name: varchar("name", { length: 80 }).notNull(),
		...timestamps,
	},
	(table) => [uniqueIndex("hackathon_tags_slug_uq").on(table.slug)],
);

export const hackathonTagLinks = pgTable(
	"hackathon_tag_links",
	{
		hackathonId: uuid("hackathon_id")
			.notNull()
			.references(() => hackathons.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => hackathonTags.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.hackathonId, table.tagId] }),
		index("hackathon_tag_links_tag_idx").on(table.tagId),
	],
);

export const savedHackathons = pgTable(
	"saved_hackathons",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		hackathonId: uuid("hackathon_id")
			.notNull()
			.references(() => hackathons.id, { onDelete: "cascade" }),
		notificationsEnabled: boolean("notifications_enabled")
			.notNull()
			.default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.hackathonId] }),
		index("saved_hackathons_hackathon_idx").on(table.hackathonId),
	],
);

/** Secondary-source observations. This is evidence only; it never sets verified. */
export const hackathonSourceChecks = pgTable(
	"hackathon_source_checks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		hackathonId: uuid("hackathon_id").references(() => hackathons.id, {
			onDelete: "cascade",
		}),
		provider: verificationProviderEnum("provider").notNull(),
		sourceUrl: text("source_url").notNull(),
		observedAt: timestamp("observed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		matchedTitle: varchar("matched_title", { length: 240 }).notNull(),
		format: hackathonFormatEnum("format"),
		startDate: timestamp("start_date", { withTimezone: true }),
		endDate: timestamp("end_date", { withTimezone: true }),
		venueCity: varchar("venue_city", { length: 120 }),
		venueCountry: varchar("venue_country", { length: 120 }),
		prizeCurrency: varchar("prize_currency", { length: 3 }),
		totalPrizeValue: integer("total_prize_value"),
		matchScore: integer("match_score").notNull(),
		checkStatus: sourceCheckStatusEnum("check_status").notNull(),
		agreedFields: text("agreed_fields")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
	},
	(table) => [
		uniqueIndex("hackathon_source_checks_provider_url_uq").on(
			table.provider,
			table.sourceUrl,
		),
		index("hackathon_source_checks_event_observed_idx").on(
			table.hackathonId,
			table.observedAt,
		),
		index("hackathon_source_checks_provider_observed_idx").on(
			table.provider,
			table.observedAt,
		),
		check(
			"hackathon_source_checks_match_score_ck",
			sql`${table.matchScore} between 0 and 100`,
		),
		check(
			"hackathon_source_checks_prize_nonnegative_ck",
			sql`${table.totalPrizeValue} is null or ${table.totalPrizeValue} >= 0`,
		),
	],
);

/** Public project metadata associated with a member; private scores live separately. */
export interface RecentProject {
	title: string;
	techStack: string[];
	link: string | null;
}

/**
 * Preloaded club roster. authUserId is nullable because the admin may import a
 * spreadsheet before the member's first passwordless sign-in. A trusted DB
 * trigger links a matching confirmed Auth email to this row.
 */
export const clubMembers = pgTable(
	"club_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		authUserId: uuid("auth_user_id").unique(),
		fullName: varchar("full_name", { length: 160 }).notNull(),
		email: text("email").notNull(),
		collegeName: varchar("college_name", { length: 180 }).notNull(),
		degree: varchar("degree", { length: 120 }),
		department: varchar("department", { length: 160 }),
		gender: varchar("gender", { length: 80 }),
		dateOfBirth: date("date_of_birth", { mode: "string" }),
		cgpa: numeric("cgpa", { precision: 9, scale: 2 }),
		cgpaScale: numeric("cgpa_scale", { precision: 7, scale: 2 }),
		membershipStatus: clubMembershipStatusEnum("membership_status")
			.notNull()
			.default("current"),
		githubUrl: text("github_url"),
		linkedinUrl: text("linkedin_url"),
		portfolioUrl: text("portfolio_url"),
		primarySkills: text("primary_skills")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		comfortableTech: text("comfortable_tech")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
		collegeYear: varchar("college_year", { length: 40 }),
		currentJobOrStudy: varchar("current_job_or_study", { length: 180 }),
		locationCity: varchar("location_city", { length: 120 }),
		canTravel: boolean("can_travel").notNull().default(false),
		recentProjects: jsonb("recent_projects")
			.$type<RecentProject[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		verifiedMember: boolean("verified_member").notNull().default(false),
		invitedAt: timestamp("invited_at", { withTimezone: true }),
		aiMatchingConsentAt: timestamp("ai_matching_consent_at", {
			withTimezone: true,
		}),
		...timestamps,
	},
	(table) => [
		uniqueIndex("club_members_email_uq").on(table.email),
		index("club_members_status_verified_idx").on(
			table.membershipStatus,
			table.verifiedMember,
		),
		index("club_members_location_idx")
			.on(table.locationCity)
			.where(sql`${table.locationCity} is not null`),
		index("club_members_skills_gin_idx").using("gin", table.primarySkills),
		index("club_members_interests_gin_idx").using("gin", table.interests),
		check(
			"club_members_email_nonempty_ck",
			sql`length(trim(${table.email})) > 3`,
		),
		check(
			"club_members_projects_array_ck",
			sql`jsonb_typeof(${table.recentProjects}) = 'array'`,
		),
		check(
			"club_members_cgpa_nonnegative_ck",
			sql`${table.cgpa} is null or ${table.cgpa} >= 0`,
		),
		check(
			"club_members_cgpa_scale_positive_ck",
			sql`${table.cgpaScale} is null or ${table.cgpaScale} > 0`,
		),
	],
);

/** Consent-based OriginBI collaboration context; never selected into public cards. */
export const memberAssessments = pgTable(
	"member_assessments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		memberId: uuid("member_id")
			.notNull()
			.references(() => clubMembers.id, { onDelete: "cascade" }),
		discProfile: varchar("disc_profile", { length: 100 }).notNull(),
		agileScore: numeric("agile_score", { precision: 9, scale: 2 }).notNull(),
		assessedAt: date("assessed_at", { mode: "string" })
			.notNull()
			.default(sql`CURRENT_DATE`),
		consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex("member_assessments_member_assessed_uq").on(
			table.memberId,
			table.assessedAt,
		),
		index("member_assessments_assessed_idx").on(table.assessedAt),
		check(
			"member_assessments_disc_ck",
			sql`${table.discProfile} in ('DI', 'DS', 'DC', 'ID', 'IS', 'IC', 'SD', 'SI', 'SC', 'CD', 'CI', 'CS')`,
		),
		check("member_assessments_agile_score_ck", sql`${table.agileScore} >= 0`),
	],
);

/**
 * Private originals uploaded by club admins. aiEnabled is an explicit
 * per-file gate: only files deliberately approved for hosted Ollama retrieval
 * can contribute text to member suggestions.
 */
export const memberLibraryFiles = pgTable(
	"member_library_files",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		uploadedBy: uuid("uploaded_by").notNull(),
		originalFilename: varchar("original_filename", { length: 240 }).notNull(),
		storagePath: text("storage_path").notNull(),
		contentType: varchar("content_type", { length: 120 }).notNull(),
		fileSize: integer("file_size").notNull(),
		sha256: varchar("sha256", { length: 64 }).notNull(),
		processingStatus: memberLibraryProcessingStatusEnum("processing_status")
			.notNull()
			.default("ready"),
		aiEnabled: boolean("ai_enabled").notNull().default(false),
		collegeName: varchar("college_name", { length: 180 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("member_library_files_storage_path_uq").on(table.storagePath),
		uniqueIndex("member_library_files_sha256_uq").on(table.sha256),
		index("member_library_files_created_idx").on(table.createdAt),
		index("member_library_files_ai_created_idx").on(
			table.aiEnabled,
			table.createdAt,
		),
		check(
			"member_library_files_size_ck",
			sql`${table.fileSize} > 0 and ${table.fileSize} <= 10485760`,
		),
	],
);

/** Searchable, private text extracted from workbook rows and text documents. */
export const memberLibraryChunks = pgTable(
	"member_library_chunks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fileId: uuid("file_id")
			.notNull()
			.references(() => memberLibraryFiles.id, { onDelete: "cascade" }),
		chunkIndex: integer("chunk_index").notNull(),
		sheetName: varchar("sheet_name", { length: 120 }),
		spreadsheetRow: integer("spreadsheet_row"),
		memberEmail: text("member_email"),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("member_library_chunks_file_order_uq").on(
			table.fileId,
			table.chunkIndex,
		),
		index("member_library_chunks_member_email_idx").on(table.memberEmail),
	],
);

export const travelFlexibilityValues = [
	"remote_only",
	"regional",
	"anywhere",
] as const;

/** Private profile submitted by a verified member seeking a team. */
export const studentHackathonRequests = pgTable(
	"student_hackathon_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").notNull(),
		fieldOfInterest: text("field_of_interest").notNull(),
		studentSkills: text("student_skills")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		techComfort: text("tech_comfort")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		rolesSought: text("roles_sought")
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		concerns: text("concerns").notNull().default(""),
		contributionSummary: text("contribution_summary").notNull(),
		locationCity: varchar("location_city", { length: 120 }),
		travelFlexibility: travelFlexibilityEnum("travel_flexibility")
			.notNull()
			.default("remote_only"),
		aiConsentAt: timestamp("ai_consent_at", { withTimezone: true }),
		status: studentRequestStatusEnum("status").notNull().default("open"),
		...timestamps,
	},
	(table) => [
		index("student_requests_owner_status_idx").on(
			table.userId,
			table.status,
			table.createdAt,
		),
		index("student_requests_open_idx")
			.on(table.createdAt)
			.where(sql`${table.status} = 'open'`),
		check(
			"student_requests_interest_nonempty_ck",
			sql`length(trim(${table.fieldOfInterest})) > 0`,
		),
		check(
			"student_requests_contribution_nonempty_ck",
			sql`length(trim(${table.contributionSummary})) > 0`,
		),
	],
);

/** Persisted event/team suggestions. Writable only by trusted server tooling. */
export const teamRecommendations = pgTable(
	"team_recommendations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		requestId: uuid("request_id")
			.notNull()
			.references(() => studentHackathonRequests.id, { onDelete: "cascade" }),
		hackathonId: uuid("hackathon_id")
			.notNull()
			.references(() => hackathons.id, { onDelete: "cascade" }),
		recommendedTeammates: uuid("recommended_teammates")
			.array()
			.notNull()
			.default(sql`'{}'::uuid[]`),
		assignedMentorId: uuid("assigned_mentor_id").references(
			() => clubMembers.id,
			{ onDelete: "set null" },
		),
		matchReasoning: text("match_reasoning").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("team_recommendations_request_hackathon_uq").on(
			table.requestId,
			table.hackathonId,
		),
		index("team_recommendations_request_idx").on(
			table.requestId,
			table.createdAt,
		),
		index("team_recommendations_hackathon_idx").on(table.hackathonId),
		check(
			"team_recommendations_reason_nonempty_ck",
			sql`length(trim(${table.matchReasoning})) > 0`,
		),
	],
);

/** Minimal feature-use telemetry; never stores prompts, results, or profile data. */
export const memberActivityEvents = pgTable(
	"member_activity_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").notNull(),
		activity: memberActivityTypeEnum("activity").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("member_activity_events_user_activity_created_idx").on(
			table.userId,
			table.activity,
			table.createdAt,
		),
		index("member_activity_events_created_idx").on(table.createdAt),
	],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type HackathonRow = typeof hackathons.$inferSelect;
export type NewHackathonRow = typeof hackathons.$inferInsert;
export type ClubMemberRow = typeof clubMembers.$inferSelect;
export type NewClubMemberRow = typeof clubMembers.$inferInsert;
export type StudentHackathonRequestRow =
	typeof studentHackathonRequests.$inferSelect;
export type NewStudentHackathonRequestRow =
	typeof studentHackathonRequests.$inferInsert;
