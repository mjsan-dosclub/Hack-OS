import { generateText } from "ai";
import {
	createJarvisModel,
	jarvisErrorResponse,
	logJarvisFailure,
} from "@/lib/ai/jarvisGateway";
import { ideaRequestSchema, ideaResponseSchema } from "@/schemas/ideator";

const SYSTEM_PROMPT =
	"You are the DeScience Open Source Club project ideator. Help students shape achievable, useful open-source hackathon projects. Return a clear project title, problem, users, core features, a small technical plan, and a first-day milestone. Keep claims grounded in the student's brief; do not invent partners, datasets, or API access. Encourage privacy, accessibility, and open collaboration.";

async function generateWithJarvisLabs(
	prompt: string,
	signal: AbortSignal,
): Promise<string> {
	const result = await generateText({
		model: createJarvisModel(),
		system: SYSTEM_PROMPT,
		prompt,
		abortSignal: signal,
		maxOutputTokens: 2400,
		maxRetries: 0,
		temperature: 0.7,
	});
	return result.text;
}

export async function POST(request: Request): Promise<Response> {
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return Response.json(
			{ error: "Request body must be valid JSON." },
			{ status: 400 },
		);
	}

	const parsed = ideaRequestSchema.safeParse(input);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid idea request." },
			{ status: 400 },
		);
	}

	const prompt = `Project brief: ${parsed.data.brief}\nTarget audience: ${parsed.data.audience || "students and community builders"}\nFocus area: ${parsed.data.focus}`;
	try {
		const idea = await generateWithJarvisLabs(prompt, request.signal);
		const responseData = ideaResponseSchema.parse({
			idea,
			provider: "jarvislabs",
		});
		return Response.json(responseData, { status: 200 });
	} catch (error: unknown) {
		logJarvisFailure("ideate", error);
		return jarvisErrorResponse(error);
	}
}
