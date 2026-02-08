import getOpenAIClient from "./openai-client";

export interface SentimentAnalysis {
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  urgency: "low" | "medium" | "high";
  escalationRecommended: boolean;
}

const SENTIMENT_SYSTEM_PROMPT = `You are a client communication analyst for an IT Managed Service Provider. Your task is to analyze the sentiment and urgency of client messages in support tickets.

Analyze the text and determine:

1. Sentiment - Choose exactly one:
   - "positive": The client is satisfied, grateful, or generally pleasant.
   - "neutral": The client is matter-of-fact, simply reporting an issue without strong emotion.
   - "negative": The client is unhappy, disappointed, or expressing dissatisfaction.
   - "frustrated": The client is visibly frustrated, angry, or threatening (e.g., to cancel service, escalate to management, leave negative reviews). This is more intense than "negative".

2. Urgency - Choose exactly one:
   - "low": The issue is a minor inconvenience or a general inquiry. No time pressure indicated.
   - "medium": The issue is impacting work but the client can partially function. Some time pressure.
   - "high": The issue is blocking work entirely, the client mentions deadlines, or multiple people are affected. Immediate attention needed.

3. Escalation Recommended - true or false:
   Set to true if ANY of the following are present:
   - The client is frustrated (not just negative, but actively frustrated or angry).
   - The client mentions wanting to speak with a manager or supervisor.
   - The client threatens to cancel their contract or switch providers.
   - The client references repeated or recurring issues that have not been resolved.
   - The issue has been ongoing for an unreasonable amount of time.
   - The client uses aggressive or hostile language.
   - The issue is critical and urgency is high.

Respond with valid JSON only:
{
  "sentiment": "<positive|neutral|negative|frustrated>",
  "urgency": "<low|medium|high>",
  "escalationRecommended": <true|false>
}`;

/**
 * Analyzes the sentiment and urgency of client communication,
 * detecting frustrated clients that may need escalation to management.
 */
export async function analyzeSentiment(
  text: string
): Promise<SentimentAnalysis | null> {
  try {
    if (!text || text.trim().length === 0) {
      return {
        sentiment: "neutral",
        urgency: "low",
        escalationRecommended: false,
      };
    }

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SENTIMENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the sentiment of the following client message:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 128,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[AI Sentiment] No content in OpenAI response");
      return null;
    }

    const parsed = JSON.parse(content) as SentimentAnalysis;

    // Validate sentiment
    const validSentiments = ["positive", "neutral", "negative", "frustrated"];
    if (!validSentiments.includes(parsed.sentiment)) {
      console.warn(
        `[AI Sentiment] Unexpected sentiment "${parsed.sentiment}", defaulting to "neutral"`
      );
      parsed.sentiment = "neutral";
    }

    // Validate urgency
    const validUrgencies = ["low", "medium", "high"];
    if (!validUrgencies.includes(parsed.urgency)) {
      console.warn(
        `[AI Sentiment] Unexpected urgency "${parsed.urgency}", defaulting to "medium"`
      );
      parsed.urgency = "medium";
    }

    // Validate escalation
    if (typeof parsed.escalationRecommended !== "boolean") {
      parsed.escalationRecommended = parsed.sentiment === "frustrated";
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[AI Sentiment] Failed to parse JSON response:", error.message);
    } else if (error instanceof Error) {
      console.error("[AI Sentiment] OpenAI API error:", error.message);
    } else {
      console.error("[AI Sentiment] Unexpected error:", error);
    }
    return null;
  }
}
