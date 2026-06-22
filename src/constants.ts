import type { Env } from "../index";

export function getConstants(env: Env) {
	const isGemini = !!env.GEMINI_API_KEY;

	return {
		GMAIL_TOKEN_URL: env.GMAIL_TOKEN_URL,
		GMAIL_API_BASE: env.GMAIL_API_BASE,
		GMAIL_READONLY_SCOPE: env.GMAIL_READONLY_SCOPE,
		llmApiBase: isGemini
			? "https://generativelanguage.googleapis.com/v1beta/openai"
			: env.OPENAI_API_BASE,
		llmApiKey: isGemini ? env.GEMINI_API_KEY! : env.OPENAI_API_SECRET,
		llmModel: isGemini ? env.GEMINI_MODEL : env.OPENAI_MODEL,
	};
}
