import openai from "./openai-client";

export interface TicketSuggestion {
  suggestion: string;
  confidence: number;
}

interface TicketInput {
  subject: string;
  description: string;
  category?: string;
}

const SUGGESTION_SYSTEM_PROMPT = `You are an experienced IT service desk technician at a Managed Service Provider (MSP). Your task is to draft a professional, helpful response to a client support ticket.

Guidelines for your response:
1. Be professional, empathetic, and solution-oriented.
2. Start by acknowledging the issue and reassuring the client.
3. Provide clear, step-by-step troubleshooting instructions when applicable.
4. If you cannot determine the exact solution, outline the diagnostic steps you plan to take.
5. Avoid overly technical jargon unless the ticket context suggests a technical audience.
6. End with next steps or an offer for follow-up.
7. Keep the response concise but thorough - aim for 3-6 paragraphs.
8. Do not fabricate specific technical details (e.g., IP addresses, server names) that are not in the ticket.

If knowledge base articles are provided as context, incorporate relevant information naturally into your response without directly quoting them.

Respond with valid JSON only:
{
  "suggestion": "<the full suggested response text>",
  "confidence": <0.0 to 1.0 indicating how confident you are this is an appropriate response>
}`;

/**
 * Generates a suggested response for an IT support ticket,
 * optionally incorporating relevant knowledge base articles.
 */
export async function suggestResponse(
  ticket: TicketInput,
  knowledgeBase?: string[]
): Promise<TicketSuggestion | null> {
  try {
    let userMessage = `Generate a suggested response for the following IT support ticket:

Subject: ${ticket.subject}

Description: ${ticket.description}`;

    if (ticket.category) {
      userMessage += `\n\nCategory: ${ticket.category}`;
    }

    if (knowledgeBase && knowledgeBase.length > 0) {
      userMessage += `\n\n--- Relevant Knowledge Base Articles ---\n`;
      knowledgeBase.forEach((article, index) => {
        userMessage += `\nArticle ${index + 1}:\n${article}\n`;
      });
      userMessage += `\n--- End of Knowledge Base Articles ---`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SUGGESTION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[AI Suggestions] No content in OpenAI response");
      return null;
    }

    const parsed = JSON.parse(content) as TicketSuggestion;

    if (!parsed.suggestion || typeof parsed.suggestion !== "string") {
      console.error("[AI Suggestions] Invalid suggestion in response");
      return null;
    }

    if (
      typeof parsed.confidence !== "number" ||
      parsed.confidence < 0 ||
      parsed.confidence > 1
    ) {
      parsed.confidence = 0.5;
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[AI Suggestions] Failed to parse JSON response:", error.message);
    } else if (error instanceof Error) {
      console.error("[AI Suggestions] OpenAI API error:", error.message);
    } else {
      console.error("[AI Suggestions] Unexpected error:", error);
    }
    return null;
  }
}
