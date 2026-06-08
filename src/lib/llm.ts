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
}

export async function extractSubscriptionData(
  text: string,
  apiBase: string,
  apiKey: string,
  model: string,
): Promise<LLMExtraction | null> {
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
          { role: "user", content: text },
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
    return JSON.parse(content) as LLMExtraction;
  } catch {
    return null;
  }
}
