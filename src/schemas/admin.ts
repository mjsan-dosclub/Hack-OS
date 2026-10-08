import { z } from "zod";

export const discPatternSchema = z.enum([
	"DI",
	"DS",
	"DC",
	"ID",
	"IS",
	"IC",
	"SD",
	"SI",
	"SC",
	"CD",
	"CI",
	"CS",
]);

export const memberLibraryRowSchema = z
	.object({
		email: z.string().email(),
		fullName: z.string().trim().min(1).max(160).nullable(),
		collegeName: z.string().trim().min(1).max(180).nullable(),
		degree: z.string().trim().max(120).nullable(),
		department: z.string().trim().max(160).nullable(),
		gender: z.string().trim().max(80).nullable(),
		dateOfBirth: z.string().date().nullable(),
		cgpa: z.number().nonnegative().max(100_000).nullable(),
		cgpaScale: z.number().positive().max(1_000).nullable(),
		membershipStatus: z
			.enum(["current", "alumnus", "mentor", "guest"])
			.nullable(),
		githubUrl: z.string().url().nullable(),
		linkedinUrl: z.string().url().nullable(),
		portfolioUrl: z.string().url().nullable(),
		primarySkills: z.array(z.string().trim().min(1).max(80)).max(40),
		comfortableTech: z.array(z.string().trim().min(1).max(80)).max(40),
		interests: z.array(z.string().trim().min(1).max(80)).max(40),
		collegeYear: z.string().trim().max(40).nullable(),
		currentJobOrStudy: z.string().trim().max(180).nullable(),
		locationCity: z.string().trim().max(120).nullable(),
		canTravel: z.boolean().nullable(),
		recentProjects: z
			.array(
				z
					.object({
						title: z.string().trim().min(1).max(180),
						techStack: z.array(z.string().trim().min(1).max(80)).max(20),
						link: z.string().url().nullable(),
					})
					.strict(),
			)
			.max(20),
		discProfile: discPatternSchema.nullable(),
		agileScore: z.number().nonnegative().max(9_999_999.99).nullable(),
		assessedAt: z.string().date().nullable(),
		assessmentConsented: z.boolean(),
	})
	.strict();

export type MemberLibraryRow = z.infer<typeof memberLibraryRowSchema>;

export const memberLibraryUploadSchema = z
	.object({
		aiEnabled: z.boolean(),
		collegeName: z.string().trim().max(180).nullable(),
	})
	.strict();

export const memberLibraryFileSchema = z
	.object({
		id: z.string().uuid(),
		originalFilename: z.string().min(1).max(240),
		contentType: z.string().min(1).max(120),
		fileSize: z.number().int().positive().max(10_485_760),
		processingStatus: z.enum(["ready", "failed"]),
		aiEnabled: z.boolean(),
		collegeName: z.string().nullable(),
		createdAt: z.string().datetime(),
		chunkCount: z.number().int().nonnegative(),
	})
	.strict();

export const memberLibraryListSchema = z
	.object({ files: z.array(memberLibraryFileSchema) })
	.strict();

export const memberLibraryUploadResultSchema = z
	.object({
		file: memberLibraryFileSchema,
		duplicate: z.literal(false),
	})
	.strict();

export const studentMasterRecordSchema = z
	.object({
		id: z.string().uuid().optional(),
		fullName: z.string().trim().min(1).max(160),
		email: z
			.string()
			.trim()
			.email()
			.max(254)
			.transform((email) => email.toLowerCase()),
		batchYear: z.string().trim().min(1).max(40),
		collegeName: z.string().trim().min(1).max(180),
		department: z.string().trim().min(1).max(160),
		degree: z.string().trim().min(1).max(120),
		gender: z.string().trim().min(1).max(80),
	})
	.strict();

export const studentMembershipStatusSchema = z.enum([
	"current",
	"alumnus",
	"mentor",
	"guest",
]);

export const studentMasterManualInputSchema = studentMasterRecordSchema
	.extend({
		membershipStatus: studentMembershipStatusSchema.default("current"),
	})
	.strict();

export const studentMasterUpdateSchema = z
	.object({
		id: z.string().uuid(),
		student: studentMasterManualInputSchema,
	})
	.strict();

export const studentMasterAdminRecordSchema = studentMasterRecordSchema.extend({
	id: z.string().uuid(),
	authLinked: z.boolean(),
	batchYear: z.string().nullable(),
	department: z.string().nullable(),
	degree: z.string().nullable(),
	gender: z.string().nullable(),
	collegeName: z.string().nullable(),
	membershipStatus: studentMembershipStatusSchema,
	verifiedMember: z.boolean(),
	lastLoginAt: z.string().datetime().nullable(),
});

export const studentMasterListSchema = z
	.object({ students: z.array(studentMasterAdminRecordSchema) })
	.strict();

export const studentMasterUploadResultSchema = z
	.object({
		processed: z.number().int().nonnegative(),
		issueCount: z.number().int().nonnegative(),
		students: z.array(studentMasterRecordSchema),
		issues: z.array(
			z
				.object({
					rowNumber: z.number().int().positive(),
					messages: z.array(z.string().min(1)),
					values: z
						.object({
							name: z.string(),
							email: z.string(),
							batch_year: z.string(),
							college: z.string(),
							department: z.string(),
							degree: z.string(),
							gender: z.string(),
							membership_status: z.string(),
						})
						.strict(),
				})
				.strict(),
		),
	})
	.strict();

export const memberLibraryDeleteSchema = z
	.object({ id: z.string().uuid() })
	.strict();

export type MemberLibraryFile = z.infer<typeof memberLibraryFileSchema>;
