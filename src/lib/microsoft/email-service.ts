import { getGraphClient } from "./graph-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailMessage {
  messageId: string;
  subject: string;
  body: string;
  from: string;
  receivedAt: Date;
  conversationId: string;
  hasAttachments: boolean;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  /** Base-64 encoded content (only present for file attachments). */
  contentBytes?: string;
}

export interface FetchEmailsResult {
  emails: EmailMessage[];
  /** Opaque delta link to use on the next sync call. */
  deltaLink: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMailbox(): string {
  const mailbox = process.env.MS_GRAPH_MAILBOX;
  if (!mailbox) {
    throw new Error(
      "Missing MS_GRAPH_MAILBOX environment variable. " +
        "Set it to the UPN or object-id of the shared / support mailbox."
    );
  }
  return mailbox;
}

/**
 * Convert a Graph API message resource into our normalised EmailMessage shape.
 */
function toEmailMessage(msg: any): EmailMessage {
  return {
    messageId: msg.id,
    subject: msg.subject ?? "(no subject)",
    body: msg.body?.content ?? "",
    from:
      msg.from?.emailAddress?.address ??
      msg.sender?.emailAddress?.address ??
      "",
    receivedAt: new Date(msg.receivedDateTime),
    conversationId: msg.conversationId ?? "",
    hasAttachments: Boolean(msg.hasAttachments),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch new emails from the given mailbox using Microsoft Graph delta queries.
 *
 * On the **first call** (no `deltaLink`), this fetches messages received since
 * `sinceDate` (defaults to 24 hours ago).  On subsequent calls supply the
 * `deltaLink` returned by the previous invocation to receive only changes.
 *
 * @param mailbox    UPN or object-id of the mailbox to query.
 * @param sinceDate  Only used on the initial sync (no deltaLink).
 * @param deltaLink  Opaque delta link from a previous call.
 */
export async function fetchNewEmails(
  mailbox: string,
  sinceDate?: Date,
  deltaLink?: string
): Promise<FetchEmailsResult> {
  const graph = getGraphClient();
  const emails: EmailMessage[] = [];
  let nextDeltaLink: string | null = null;

  // If we already have a deltaLink, use it directly to get changes.
  // Otherwise build an initial delta query with a date filter.
  let url: string;

  if (deltaLink) {
    url = deltaLink; // absolute URL returned by Graph
  } else {
    const since = sinceDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filter = `receivedDateTime ge ${since.toISOString()}`;
    url =
      `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages/delta` +
      `?$filter=${encodeURIComponent(filter)}` +
      `&$select=id,subject,body,from,sender,receivedDateTime,conversationId,hasAttachments` +
      `&$orderby=receivedDateTime desc` +
      `&$top=50`;
  }

  // Page through all results.
  while (url) {
    const response: any = await graph.get(url);

    const messages: any[] = response.value ?? [];
    for (const msg of messages) {
      // Delta responses may include @removed markers -- skip those.
      if (msg["@removed"]) continue;
      emails.push(toEmailMessage(msg));
    }

    if (response["@odata.deltaLink"]) {
      nextDeltaLink = response["@odata.deltaLink"];
      url = ""; // stop paging
    } else if (response["@odata.nextLink"]) {
      url = response["@odata.nextLink"];
    } else {
      url = "";
    }
  }

  return { emails, deltaLink: nextDeltaLink };
}

/**
 * Send an email from the support mailbox.
 *
 * @param to         Recipient email address.
 * @param subject    Email subject.
 * @param body       HTML body content.
 * @param inReplyTo  Optional Graph message-id to reply to (creates a reply in
 *                   the same conversation thread).
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string
): Promise<void> {
  const graph = getGraphClient();
  const mailbox = getMailbox();

  if (inReplyTo) {
    // When replying, use the /reply endpoint to keep threading intact.
    const replyUrl = `/users/${encodeURIComponent(mailbox)}/messages/${inReplyTo}/reply`;

    await graph.post(replyUrl, {
      message: {
        toRecipients: [{ emailAddress: { address: to } }],
      },
      comment: body,
    });
  } else {
    // New message.
    const sendUrl = `/users/${encodeURIComponent(mailbox)}/sendMail`;

    await graph.post(sendUrl, {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: body,
        },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    });
  }
}

/**
 * Retrieve all attachments for a given email message.
 *
 * @param messageId  Graph message id.
 * @param mailbox    Optional mailbox override (defaults to MS_GRAPH_MAILBOX).
 */
export async function getEmailAttachments(
  messageId: string,
  mailbox?: string
): Promise<EmailAttachment[]> {
  const graph = getGraphClient();
  const mb = mailbox ?? getMailbox();

  const url =
    `/users/${encodeURIComponent(mb)}/messages/${messageId}/attachments` +
    `?$select=id,name,contentType,size,contentBytes`;

  const response: any = await graph.get(url);
  const items: any[] = response.value ?? [];

  return items.map((att) => ({
    id: att.id,
    name: att.name ?? "attachment",
    contentType: att.contentType ?? "application/octet-stream",
    size: att.size ?? 0,
    contentBytes: att.contentBytes,
  }));
}

/**
 * Mark an email message as read.
 *
 * @param messageId  Graph message id.
 * @param mailbox    Optional mailbox override (defaults to MS_GRAPH_MAILBOX).
 */
export async function markAsRead(
  messageId: string,
  mailbox?: string
): Promise<void> {
  const graph = getGraphClient();
  const mb = mailbox ?? getMailbox();

  const url = `/users/${encodeURIComponent(mb)}/messages/${messageId}`;

  await graph.patch(url, { isRead: true });
}
