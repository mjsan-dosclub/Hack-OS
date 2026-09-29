import { APICallError, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
	ideaRequestSchema,
	ideaResponseSchema,
	jarvisLabsConfigSchema,
} from "@/schemas/ideator";

const SYSTEM_PROMPT =
	"You are the DeScience Open Source Club project ideator. Help students shape achievable, useful open-source hackathon projects. Return a clear project title, problem, users, core features, a small technical plan, and a first-day milestone. Keep claims grounded in the student's brief; do not invent partners, datasets, or API access. Encourage privacy, accessibility, and open collaboration.";

function redactSecrets(message: string): string {
	let safeMessage = message;
	const jarvisKey = process.env.JARVISLABS_API_KEY;
	if (jarvisKey) safeMessage = safeMessage.replaceAll(jarvisKey, "[REDACTED]");
	return safeMessage.slice(0, 800);
}

function logProviderFailure(provider: string, error: unknown): void {
	if (APICallError.isInstance(error)) {
		console.error(`[ideate] ${provider} request failed`, {
			statusCode: error.statusCode,
			detail: redactSecrets(error.responseBody ?? error.message),
		});
		return;
	}

	const detail =
		error instanceof Error ? error.message : "Unknown provider error.";
	console.error(`[ideate] ${provider} request failed`, redactSecrets(detail));
}

function isTransientProviderFailure(error: unknown): boolean {
	if (APICallError.isInstance(error)) {
		const status = error.statusCode;
		return (
			status === 408 ||
			status === 429 ||
			(status !== undefined && status >= 500)
		);
	}

	const detail = error instanceof Error ? error.message : "";
	return /high demand|temporar|overload|fetch failed|timed? ?out|econnreset|resource_exhausted/i.test(
		detail,
	);
}

function providerFailureResponse(error: unknown): Response {
	if (
		APICallError.isInstance(error) &&
		(error.statusCode === 401 || error.statusCode === 403)
	) {
		return Response.json(
			{
				error:
					"JarvisLabs rejected its API key. Check the server-side settings in .env.local.",
			},
			{ status: 502 },
		);
	}
	if (isTransientProviderFailure(error)) {
		return Response.json(
			{
				error:
					"The JarvisLabs Ollama endpoint is temporarily busy. Please retry shortly.",
			},
			{ status: 503 },
		);
	}
	return Response.json(
		{
			error:
				"JarvisLabs Ollama could not generate an idea right now. Please retry shortly.",
		},
		{ status: 502 },
	);
}

async function generateWithJarvisLabs(
	prompt: string,
	signal: AbortSignal,
): Promise<string> {
	const config = jarvisLabsConfigSchema.safeParse({
		apiKey: process.env.JARVISLABS_API_KEY,
		baseURL: process.env.JARVISLABS_BASE_URL,
		model: process.env.JARVISLABS_MODEL,
	});
	if (!config.success)
		throw new Error("JarvisLabs endpoint settings are missing or invalid.");

	// JarvisLabs exposes the development Ollama model through an OpenAI-compatible API.
	const jarvis = createOpenAI({
		baseURL: config.data.baseURL,
		apiKey: config.data.apiKey,
	});
	const result = await generateText({
		model: jarvis(config.data.model),
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
	const hasJarvisConfig = jarvisLabsConfigSchema.safeParse({
		apiKey: process.env.JARVISLABS_API_KEY,
		baseURL: process.env.JARVISLABS_BASE_URL,
		model: process.env.JARVISLABS_MODEL,
	}).success;

	if (!hasJarvisConfig) {
		return Response.json(
			{
				error:
					"Configure JARVISLABS_API_KEY, JARVISLABS_BASE_URL, and JARVISLABS_MODEL on the server to enable idea generation.",
			},
			{ status: 503 },
		);
	}

	try {
		const idea = await generateWithJarvisLabs(prompt, request.signal);
		const responseData = ideaResponseSchema.parse({
			idea,
			provider: "jarvislabs",
		});
		return Response.json(responseData, { status: 200 });
	} catch (error: unknown) {
		logProviderFailure("jarvislabs", error);
		return providerFailureResponse(error);
	}
}
