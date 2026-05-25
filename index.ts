export interface Env {
	DB: D1Database;
	SESSIONS_KV: KVNamespace;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}

import { createAuth } from "./src/auth";

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("server is healthy", { status: 200 });
		}

		if (url.pathname.startsWith("/api/auth/")) {
			const auth = createAuth(env);
			return auth.handler(request);
		}

		return new Response("Not Found", { status: 404 });
	},
};
