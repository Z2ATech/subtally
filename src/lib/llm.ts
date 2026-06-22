import { SUBSCRIPTION_EXTRACTION_PROMPT } from "../prompts/subscription-extraction";

export interface LLMExtraction {
  vendor_name: string | null;
  amount: number | null;
  currency: string | null;
  frequency: "monthly" | "yearly" | "weekly" | "one_time" | null;
  next_billing_date: string | null;
  category:
    | "streaming"
    | "software"
    | "cloud"
    | "gaming"
    | "news"
    | "fitness"
    | "other"
    | null;
  email_type: "subscription" | "cancellation" | "renewal" | "unknown";
  confidence: number;
}

export async function extractSubscriptionData(
  text: string,
  senderDomain: string | null,
  apiBase: string,
  apiKey: string,
  model: string,
): Promise<LLMExtraction | null> {
  const userMessage = [
    "Context:",
    `sender_domain: ${senderDomain ?? "unknown"}`,
    "",
    "Email body:",
    text,
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SUBSCRIPTION_EXTRACTION_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      }),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(stripJsonFence(content)) as LLMExtraction;
  } catch {
    return null;
  }
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ? match[1].trim() : trimmed;
}
