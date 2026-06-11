export function deriveStatus(
	latestEventType: string | null,
	latestEventAt: Date | null,
	frequency: string | null,
	now = new Date()
): "active" | "cancelled" | "unknown" {
	if (!latestEventType || !latestEventAt) return "unknown";
	if (latestEventType === "cancellation") return "cancelled";

	const thresholdDays = frequency === "yearly" ? 365 : 90;
	const elapsed = (now.getTime() - latestEventAt.getTime()) / (1000 * 60 * 60 * 24);

	return elapsed > thresholdDays ? "unknown" : "active";
}
