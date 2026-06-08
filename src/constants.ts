import type { Env } from "../index";

export function getConstants(env: Env) {
	return {
		GMAIL_TOKEN_URL: env.GMAIL_TOKEN_URL,
		GMAIL_API_BASE: env.GMAIL_API_BASE,
		OPENAI_API_BASE: env.OPENAI_API_BASE,
		GMAIL_READONLY_SCOPE: env.GMAIL_READONLY_SCOPE,
	};
}
