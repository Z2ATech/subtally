export async function checkRateLimit(
	rateLimiter: RateLimit,
	userId: string,
): Promise<Response | null> {
	const { success } = await rateLimiter.limit({ key: userId });
	if (!success) return Response.json({ error: "Too Many Requests" }, { status: 429 });
	return null;
}
