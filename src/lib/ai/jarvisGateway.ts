import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, type LanguageModel } from "ai";
import { jarvisLabsConfigSchema } from "@/schemas/ideator";

export type JarvisFailureKind =
	| "configuration"
	| "credentials"
	| "busy"
	| "upstream";

export class JarvisGatewayError extends Error {
	constructor(
		readonly kind: JarvisFailureKind,
		message: string,
		readonly statusCode: number | null = null,
	) {
		super(message);
		this.name = "JarvisGatewayError";
	}
}

/** Build the sole AI model used by user-facing features from server-only config. */
export function createJarvisModel(): LanguageModel {
	const config = jarvisLabsConfigSchema.safeParse({
		apiKey: process.env.JARVISLABS_API_KEY,
		baseURL: process.env.JARVISLABS_BASE_URL,
		model: process.env.JARVISLABS_MODEL,
	});
	if (!config.success) {
		throw new JarvisGatewayError(
			"configuration",
			"JarvisLabs endpoint settings are missing or invalid.",
		);
	}
	const client = createOpenAI({
		baseURL: config.data.baseURL,
		apiKey: config.data.apiKey,
	});
	return client(config.data.model);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown provider error.";
}

/** Jarvis can wrap its HTTP status inside a non-OpenAI error response. */
export function jarvisStatusCode(error: unknown): number | null {
	if (error instanceof JarvisGatewayError) return error.statusCode;
	if (APICallError.isInstance(error) && error.statusCode !== undefined)
		return error.statusCode;
	const match = errorMessage(error).match(/status_code.{0,5}(\d{3})/i);
	return match?.[1] ? Number(match[1]) : null;
}

export function classifyJarvisFailure(error: unknown): JarvisFailureKind {
	if (error instanceof JarvisGatewayError) return error.kind;
	const statusCode = jarvisStatusCode(error);
	if (statusCode === 401 || statusCode === 403) return "credentials";
	if (
		statusCode === 408 ||
		statusCode === 429 ||
		(statusCode !== null && statusCode >= 500) ||
		/workers busy|timed? ?out|overload|high demand|temporarily busy/i.test(
			errorMessage(error),
		)
	) {
		return "busy";
	}
	return "upstream";
}

function redactApiKey(message: string): string {
	const key = process.env.JARVISLABS_API_KEY;
	return key
		? message.replaceAll(key, "[REDACTED]").slice(0, 500)
		: message.slice(0, 500);
}

export function logJarvisFailure(feature: string, error: unknown): void {
	console.error(
		JSON.stringify({
			event: "jarvis_request_failed",
			feature,
			kind: classifyJarvisFailure(error),
			statusCode: jarvisStatusCode(error),
			detail: redactApiKey(errorMessage(error)),
		}),
	);
}

export function jarvisErrorResponse(error: unknown): Response {
	const kind = classifyJarvisFailure(error);
	const message =
		kind === "configuration"
			? "The AI service is not configured. Contact a club admin."
			: kind === "credentials"
				? "The AI service needs an admin credential update. Please try again later."
				: kind === "busy"
					? "The AI service is busy. Your request was not lost; please retry shortly."
					: "The AI service could not complete this request. Please retry.";
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (kind === "busy") headers.set("Retry-After", "15");
	return Response.json(
		{ error: message },
		{
			status: kind === "credentials" || kind === "upstream" ? 502 : 503,
			headers,
		},
	);
}
