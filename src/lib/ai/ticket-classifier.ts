import getOpenAIClient from "./openai-client";

export interface TicketClassification {
  category: string;
  subcategory: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert IT service desk AI classifier for a Managed Service Provider (MSP). Your job is to analyze incoming support tickets and classify them accurately.

You must classify each ticket into exactly one of the following categories:
- Network: Issues with connectivity, VPN, DNS, DHCP, firewall, switches, routers, Wi-Fi, internet outages
- Hardware: Physical device failures, broken screens, faulty peripherals, overheating, disk failures, RAM issues
- Software: Application crashes, installation problems, updates, compatibility issues, OS errors, licensing
- Email: Outlook issues, email delivery failures, spam/filtering, mailbox full, calendar sync, shared mailboxes
- Security: Malware/virus, phishing, unauthorized access, MFA issues, suspicious activity, data breach concerns
- Backup: Backup failures, restore requests, disaster recovery, data loss, backup storage
- Printing: Printer offline, print queue stuck, driver issues, scanner problems, paper jams, toner replacement
- Account/Access: Password resets, account lockouts, new user provisioning, permissions, group membership, license assignment
- Other: Anything that does not clearly fit the above categories

For the subcategory, provide a more specific classification within the chosen category (e.g., category "Network" could have subcategory "VPN Connectivity" or "DNS Resolution").

For priority, assess based on the following guidelines:
- CRITICAL: Complete service outage affecting multiple users, security breach, data loss in progress, server down
- HIGH: Single user completely blocked from working, executive-impacted, SLA at risk, security concern
- MEDIUM: User can partially work, non-urgent but impactful, scheduled maintenance needed
- LOW: Minor inconvenience, cosmetic issues, feature requests, general questions

Respond with valid JSON only. Do not include any other text.

JSON format:
{
  "category": "<category>",
  "subcategory": "<specific subcategory>",
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "confidence": <0.0 to 1.0>
}`;

/**
 * Classifies a support ticket using OpenAI GPT-4 to determine
 * category, subcategory, suggested priority, and confidence level.
 */
export async function classifyTicket(
  subject: string,
  description: string
): Promise<TicketClassification | null> {
  try {
    const userMessage = `Classify the following IT support ticket:

Subject: ${subject}

Description: ${description}`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[AI Classifier] No content in OpenAI response");
      return null;
    }

    const parsed = JSON.parse(content) as TicketClassification;

    // Validate the parsed response has expected fields
    const validCategories = [
      "Network",
      "Hardware",
      "Software",
      "Email",
      "Security",
      "Backup",
      "Printing",
      "Account/Access",
      "Other",
    ];
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

    if (!validCategories.includes(parsed.category)) {
      console.warn(
        `[AI Classifier] Unexpected category "${parsed.category}", defaulting to "Other"`
      );
      parsed.category = "Other";
    }

    if (!validPriorities.includes(parsed.priority)) {
      console.warn(
        `[AI Classifier] Unexpected priority "${parsed.priority}", defaulting to "MEDIUM"`
      );
      parsed.priority = "MEDIUM";
    }

    if (
      typeof parsed.confidence !== "number" ||
      parsed.confidence < 0 ||
      parsed.confidence > 1
    ) {
      parsed.confidence = 0.5;
    }

    if (!parsed.subcategory || typeof parsed.subcategory !== "string") {
      parsed.subcategory = "General";
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[AI Classifier] Failed to parse JSON response:", error.message);
    } else if (error instanceof Error) {
      console.error("[AI Classifier] OpenAI API error:", error.message);
    } else {
      console.error("[AI Classifier] Unexpected error:", error);
    }
    return null;
  }
}
