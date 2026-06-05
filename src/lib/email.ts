export function base64urlToBytes(b64: string): Uint8Array {
	const b64std = b64.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64std);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function extractHeader(rawBytes: Uint8Array, name: string): string {
	// Find \r\n\r\n in bytes first — decode only the header section, not the full body
	let headerEnd = -1;
	for (let i = 0; i < rawBytes.length - 3; i++) {
		if (rawBytes[i] === 0x0d && rawBytes[i + 1] === 0x0a && rawBytes[i + 2] === 0x0d && rawBytes[i + 3] === 0x0a) {
			headerEnd = i;
			break;
		}
	}
	const headerBytes = headerEnd >= 0 ? rawBytes.slice(0, headerEnd) : rawBytes;
	const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: false }).decode(headerBytes);
	const unfolded = text.replace(/\r\n[ \t]+/g, " ");
	for (const line of unfolded.split("\r\n")) {
		const colon = line.indexOf(":");
		if (colon > 0 && line.slice(0, colon).toLowerCase() === name.toLowerCase()) {
			return line.slice(colon + 1).trim();
		}
	}
	return "";
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
