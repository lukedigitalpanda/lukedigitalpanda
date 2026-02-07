import openai from "./openai-client";

interface TicketComment {
  content: string;
  author: string;
  createdAt: string;
}

interface TicketInput {
  subject: string;
  description: string;
  comments: TicketComment[];
}

const SUMMARIZER_SYSTEM_PROMPT = `You are an IT service desk assistant that creates concise, actionable summaries of support tickets for technicians and managers.

Your summary should include:
1. A one-sentence overview of the issue.
2. Key details and any relevant technical information.
3. The current state of the conversation (e.g., awaiting response, troubleshooting steps attempted, resolution proposed).
4. Any outstanding action items or next steps.

Guidelines:
- Keep the summary under 200 words.
- Use bullet points for clarity where appropriate.
- Focus on facts - do not speculate beyond the information provided.
- Highlight any escalation triggers (e.g., repeated issues, frustrated client, SLA risk).
- If the ticket has been resolved, state the resolution clearly.

Respond with the summary text only. Do not wrap it in JSON or any other format.`;

/**
 * Summarizes a support ticket including its full conversation history
 * into a concise, actionable summary for technicians and managers.
 */
export async function summarizeTicket(
  ticket: TicketInput
): Promise<string | null> {
  try {
    let userMessage = `Summarize the following IT support ticket:

Subject: ${ticket.subject}

Original Description:
${ticket.description}`;

    if (ticket.comments && ticket.comments.length > 0) {
      userMessage += `\n\n--- Conversation History ---`;
      for (const comment of ticket.comments) {
        userMessage += `\n\n[${comment.createdAt}] ${comment.author}:\n${comment.content}`;
      }
      userMessage += `\n\n--- End of Conversation History ---`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SUMMARIZER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[AI Summarizer] No content in OpenAI response");
      return null;
    }

    return content.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error("[AI Summarizer] OpenAI API error:", error.message);
    } else {
      console.error("[AI Summarizer] Unexpected error:", error);
    }
    return null;
  }
}
