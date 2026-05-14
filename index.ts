export interface Env {
	DB: D1Database;
	SESSIONS_KV: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);
		if (url.pathname === "/health") {
			return new Response(`server is healthy`, { status: 200 });
		}

		// Minimal demonstration response; bindings are available on `env`.
		return new Response("Hello from Subtally Worker", {
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});
	},
};
