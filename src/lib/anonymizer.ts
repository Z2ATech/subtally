const PATTERNS: [RegExp, string][] = [
	// Card numbers (16-digit groups) — before phone to avoid partial overlap
	[/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, "[CARD]"],
	// Email addresses
	[/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g, "[EMAIL]"],
	// Phone numbers — international (+92, +44, +1), US, Pakistani (03xx), UK (07xxx)
	[/(\+?\d{1,3}[\s\-.])?(\(?\d{2,4}\)?[\s\-.])\d{3,4}[\s\-.]\d{4,7}/g, "[PHONE]"],
	// Street addresses — number + street name + type
	[/\b\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir)\b/gi, "[ADDRESS]"],
];

export function anonymize(text: string): string {
	let result = text;
	for (const [pattern, placeholder] of PATTERNS) {
		result = result.replace(pattern, placeholder);
	}
	return result;
}
