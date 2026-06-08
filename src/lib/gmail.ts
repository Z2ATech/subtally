import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as authSchema from "../db/auth-schema";

interface TokenResponse {
	access_token: string;
	expires_in: number;
	scope: string;
	token_type: string;
}

interface ListMessagesResponse {
	messages?: Array<{ id: string; threadId: string }>;
	nextPageToken?: string;
	resultSizeEstimate: number;
}

export interface MessagePart {
	mimeType: string;
	body: { data?: string; size: number };
	parts?: MessagePart[];
}

export interface GetMessageResponse {
	id: string;
	threadId: string;
	snippet: string;
	internalDate: string;
	payload: MessagePart & {
		headers: Array<{ name: string; value: string }>;
	};
}

/**
 * Exchange a Google refresh token for an access token
 */
async function getAccessToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string,
	tokenUrl: string
): Promise<string> {
	const response = await retryFetch(
		tokenUrl,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: refreshToken,
				grant_type: "refresh_token",
			}).toString(),
		},
		1 // max 1 retry for token endpoint
	);

	if (!response.ok) {
		const err = (await response.json()) as { error: string };
		throw new Error(`Token exchange failed: ${err.error}`);
	}

	const data = (await response.json()) as TokenResponse;
	return data.access_token;
}

/**
 * List Gmail messages matching a query
 */
export async function listMessages(
	accessToken: string,
	query: string,
	apiBase: string,
	pageToken?: string
): Promise<{ messages: Array<{ id: string; threadId: string }> | undefined; nextPageToken?: string }> {
	const url = new URLSearchParams({
		q: query,
		maxResults: "50",
		...(pageToken && { pageToken }),
	});

	const response = await retryFetch(
		`${apiBase}/users/me/messages?${url}`,
		{
			method: "GET",
			headers: { Authorization: `Bearer ${accessToken}` },
		}
	);

	if (!response.ok) {
		throw new Error(`Gmail list failed: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as ListMessagesResponse;
	return {
		messages: data.messages,
		nextPageToken: data.nextPageToken,
	};
}

/**
 * Get a Gmail message with full parsed headers and payload
 */
export async function getMessage(
	accessToken: string,
	messageId: string,
	apiBase: string
): Promise<GetMessageResponse> {
	const url = new URLSearchParams({ format: "full" });

	const response = await retryFetch(
		`${apiBase}/users/me/messages/${messageId}?${url}`,
		{
			method: "GET",
			headers: { Authorization: `Bearer ${accessToken}` },
		}
	);

	if (!response.ok) {
		throw new Error(`Gmail get failed: ${response.status} ${response.statusText}`);
	}

	return response.json() as Promise<GetMessageResponse>;
}

/**
 * Get the refresh token for the current user from the database
 */
export async function getRefreshTokenForUser(
	db: ReturnType<typeof drizzle<any>>,
	userId: string
): Promise<string | null> {
	const account = await db
		.select()
		.from(authSchema.account)
		.where(
			and(
				eq(authSchema.account.userId, userId),
				eq(authSchema.account.providerId, "google")
			)
		)
		.limit(1);

	return account[0]?.refreshToken ?? null;
}

/**
 * Fetch with retry logic for 429 and 5xx errors
 */
async function retryFetch(
	url: string,
	options: RequestInit,
	maxRetries: number = 1
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url, options);

			// Retry on 429 (rate limit) or 5xx errors
			if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}

			return response;
		} catch (error) {
			lastError = error as Error;
			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	throw lastError || new Error("Fetch failed after retries");
}

/**
 * Paginate through all Gmail messages matching a query (max 500 per page)
 */
export async function listAllMessages(
	accessToken: string,
	query: string,
	apiBase: string
): Promise<Array<{ id: string; threadId: string }>> {
	const all: Array<{ id: string; threadId: string }> = [];
	let pageToken: string | undefined;

	do {
		const { messages, nextPageToken } = await listMessages(accessToken, query, apiBase, pageToken);
		if (messages) all.push(...messages);
		pageToken = nextPageToken;
	} while (pageToken);

	return all;
}

/**
 * High-level helper to get access token from refresh token stored in DB
 */
export async function getAccessTokenFromRefresh(
	db: ReturnType<typeof drizzle<any>>,
	userId: string,
	clientId: string,
	clientSecret: string,
	tokenUrl: string
): Promise<string | null> {
	const refreshToken = await getRefreshTokenForUser(db, userId);
	if (!refreshToken) return null;

	return getAccessToken(refreshToken, clientId, clientSecret, tokenUrl);
}
