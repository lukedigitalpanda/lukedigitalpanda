import prisma from "@/lib/prisma";
import { classifyTicket } from "@/lib/ai/ticket-classifier";
import type { TicketStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncomingEmail {
  messageId: string;
  subject: string;
  body: string;
  from: string;
  receivedAt: Date;
  conversationId: string;
}

export interface ProcessResult {
  action: "ticket_created" | "comment_added" | "duplicate_skipped";
  ticketId: string;
  ticketNumber?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip common HTML tags to produce a plain-text-ish version of the email body.
 * Used for storing readable content in ticket descriptions and comments.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Try to find an existing ticket that belongs to the same email conversation.
 *
 * We check both `emailThreadId` (which stores the Graph conversationId) and
 * `emailMessageId` for direct matches.
 */
async function findExistingTicketByThread(
  conversationId: string,
  messageId: string
) {
  // First: match on conversationId stored as emailThreadId.
  const byThread = await prisma.ticket.findFirst({
    where: { emailThreadId: conversationId },
    orderBy: { createdAt: "desc" },
  });
  if (byThread) return byThread;

  // Fallback: check if we already processed this exact message.
  const byMessage = await prisma.ticket.findFirst({
    where: { emailMessageId: messageId },
  });
  if (byMessage) return byMessage;

  // Also look inside comments for a matching emailMessageId to cover replies
  // that were already ingested.
  const commentMatch = await prisma.ticketComment.findFirst({
    where: { emailMessageId: messageId },
    select: { ticketId: true },
  });
  if (commentMatch) {
    return prisma.ticket.findUnique({
      where: { id: commentMatch.ticketId },
    });
  }

  return null;
}

/**
 * Try to match the sender email address to a ClientContact record.
 * Returns the contact and its parent client, or null.
 */
async function matchSenderToContact(email: string) {
  const contact = await prisma.clientContact.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
    include: { client: true },
  });

  return contact;
}

/**
 * Get (or create) a system user for automated actions.
 * This user is used as the `createdBy` when a ticket is created from an email.
 */
async function getSystemUser() {
  const systemEmail = "system@servicedesk.local";

  let user = await prisma.user.findUnique({
    where: { email: systemEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "System (Email)",
        email: systemEmail,
        role: "TECHNICIAN",
        isActive: true,
      },
    });
  }

  return user;
}

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------

/**
 * Process a single incoming email and either create a new ticket or append a
 * comment to an existing one.
 *
 * Flow:
 * 1. Check if the email message was already processed (de-duplicate).
 * 2. Check if this email belongs to an existing conversation thread.
 *    - If yes: add a comment to the ticket.
 *    - If the ticket was WAITING_ON_CLIENT, reopen it to OPEN.
 * 3. If new conversation: create a new ticket.
 *    - Match the sender to a ClientContact for proper association.
 *    - Run the AI classifier to categorise the ticket.
 * 4. Persist emailMessageId and emailThreadId for future threading.
 */
export async function processIncomingEmail(
  email: IncomingEmail
): Promise<ProcessResult> {
  const { messageId, subject, body, from, receivedAt, conversationId } = email;
  const plainBody = stripHtml(body);

  // ------------------------------------------------------------------
  // 1. De-duplicate: skip if we already ingested this exact message.
  // ------------------------------------------------------------------
  const existingComment = await prisma.ticketComment.findFirst({
    where: { emailMessageId: messageId },
  });
  if (existingComment) {
    return {
      action: "duplicate_skipped",
      ticketId: existingComment.ticketId,
    };
  }

  const existingTicket = await prisma.ticket.findFirst({
    where: { emailMessageId: messageId },
  });
  if (existingTicket) {
    return {
      action: "duplicate_skipped",
      ticketId: existingTicket.id,
      ticketNumber: existingTicket.number,
    };
  }

  // ------------------------------------------------------------------
  // 2. Check if this email is part of an existing conversation thread.
  // ------------------------------------------------------------------
  const threadTicket = await findExistingTicketByThread(
    conversationId,
    messageId
  );

  if (threadTicket) {
    // Resolve system user for the comment author.
    const systemUser = await getSystemUser();

    // Add the email body as a comment on the existing ticket.
    await prisma.ticketComment.create({
      data: {
        ticketId: threadTicket.id,
        authorId: systemUser.id,
        content: `**Email from ${from}:**\n\n${plainBody}`,
        isInternal: false,
        isEmail: true,
        emailMessageId: messageId,
      },
    });

    // If the ticket was waiting on the client, reopen it now that they replied.
    const statusToReopen: TicketStatus = "WAITING_ON_CLIENT";
    if (threadTicket.status === statusToReopen) {
      await prisma.ticket.update({
        where: { id: threadTicket.id },
        data: { status: "OPEN", updatedAt: new Date() },
      });

      // Log the status change as an activity.
      const systemUser = await getSystemUser();
      await prisma.ticketActivity.create({
        data: {
          ticketId: threadTicket.id,
          userId: systemUser.id,
          action: "status_changed",
          oldValue: "WAITING_ON_CLIENT",
          newValue: "OPEN",
          details: "Client replied via email; ticket reopened automatically.",
        },
      });
    }

    return {
      action: "comment_added",
      ticketId: threadTicket.id,
      ticketNumber: threadTicket.number,
    };
  }

  // ------------------------------------------------------------------
  // 3. New conversation -- create a new ticket.
  // ------------------------------------------------------------------
  const systemUser = await getSystemUser();
  const contact = await matchSenderToContact(from);

  // Determine the client. If we matched a contact, use their client.
  // Otherwise fall back to a default / unassigned client.
  let clientId: string;
  let contactId: string | undefined;

  if (contact) {
    clientId = contact.clientId;
    contactId = contact.id;
  } else {
    // Find or create a catch-all client for unknown senders.
    let unknownClient = await prisma.client.findFirst({
      where: { name: "Unknown / Unassigned" },
    });
    if (!unknownClient) {
      unknownClient = await prisma.client.create({
        data: {
          name: "Unknown / Unassigned",
          isActive: true,
        },
      });
    }
    clientId = unknownClient.id;
  }

  // Run the AI classifier to get category / priority suggestions.
  let aiFields: {
    aiCategory?: string;
    aiSummary?: string;
    aiSuggestion?: string;
    aiConfidence?: number;
    category?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  } = {};

  try {
    const classification = await classifyTicket(subject, plainBody);
    aiFields = {
      aiCategory: classification.category,
      aiSummary: classification.summary,
      aiSuggestion: classification.suggestion,
      aiConfidence: classification.confidence,
      category: classification.category,
      priority: classification.priority,
    };
  } catch (err) {
    // AI classification is best-effort. Log and continue.
    console.error("[email-to-ticket] AI classification failed:", err);
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject: subject || "(no subject)",
      description: plainBody,
      status: "OPEN",
      priority: aiFields.priority ?? "MEDIUM",
      source: "EMAIL",
      category: aiFields.category,
      emailMessageId: messageId,
      emailThreadId: conversationId,
      clientId,
      contactId,
      createdById: systemUser.id,
      aiCategory: aiFields.aiCategory,
      aiSummary: aiFields.aiSummary,
      aiSuggestion: aiFields.aiSuggestion,
      aiConfidence: aiFields.aiConfidence,
    },
  });

  // Log the creation activity.
  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      userId: systemUser.id,
      action: "created",
      newValue: "OPEN",
      details: `Ticket created automatically from email sent by ${from}.`,
    },
  });

  return {
    action: "ticket_created",
    ticketId: ticket.id,
    ticketNumber: ticket.number,
  };
}
