import type { GetMessageResponse, MessagePart } from "../lib/gmail";

export function base64urlToBytes(b64: string): Uint8Array {
	const b64std = b64.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64std);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function extractBodyBytes(payload: GetMessageResponse["payload"]): Uint8Array {
	const queue: MessagePart[] = [payload];
	let htmlFallback: Uint8Array | null = null;

	while (queue.length > 0) {
		const part = queue.shift()!;

		if (part.mimeType === "text/plain" && part.body?.data) {
			return base64urlToBytes(part.body.data);
		}
		if (part.mimeType === "text/html" && part.body?.data && !htmlFallback) {
			htmlFallback = base64urlToBytes(part.body.data);
		}
		if (part.parts) {
			queue.push(...part.parts);
		}
	}

	if (payload.body?.data) return base64urlToBytes(payload.body.data);
	return htmlFallback ?? new Uint8Array(0);
}

export function extractDomain(from: string): string {
	const match = from.match(/<([^>]+)>/) ?? from.match(/(\S+@\S+)/);
	if (!match?.[1]) return "";
	const [, domain] = match[1].split("@");
	return domain ? domain.toLowerCase() : "";
}

export async function computeChecksum(rawBytes: Uint8Array, senderDomain: string): Promise<string> {
	const domainBytes = new TextEncoder().encode(senderDomain);
	const combined = new Uint8Array(rawBytes.length + domainBytes.length);
	combined.set(rawBytes);
	combined.set(domainBytes, rawBytes.length);
	const buf = await crypto.subtle.digest("SHA-256", combined);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
