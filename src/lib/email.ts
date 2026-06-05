import type { GetMessageResponse } from "../lib/gmail";

export function base64urlToBytes(b64: string): Uint8Array {
	const b64std = b64.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64std);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function extractBodyBytes(payload: GetMessageResponse["payload"]): Uint8Array {
	if (payload.body.data) return base64urlToBytes(payload.body.data);
	const textPart = payload.parts?.find((p) => p.mimeType === "text/plain")
		?? payload.parts?.find((p) => p.mimeType === "text/html");
	if (textPart?.body.data) return base64urlToBytes(textPart.body.data);
	return new Uint8Array(0);
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
