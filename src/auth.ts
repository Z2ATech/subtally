import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./db/auth-schema";

export function createAuth(env: { DB: D1Database; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }) {
	const db = drizzle(env.DB);
	
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: authSchema,
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		socialProviders: {
			google: {
				enabled: true,
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				scope: ["https://www.googleapis.com/auth/gmail.readonly"],
				accessType: "offline",
				prompt: "consent",
			},
		},
	});
}
