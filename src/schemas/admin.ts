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
		memberImport: z
			.object({
				newMembers: z.number().int().nonnegative(),
				updatedMembers: z.number().int().nonnegative(),
				assessmentsStored: z.number().int().nonnegative(),
				unmatchedRows: z.number().int().nonnegative(),
			})
			.strict(),
	})
	.strict();

export const memberLibraryDeleteSchema = z
	.object({ id: z.string().uuid() })
	.strict();

export type MemberLibraryFile = z.infer<typeof memberLibraryFileSchema>;
