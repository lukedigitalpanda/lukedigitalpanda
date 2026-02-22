import prisma from "@/lib/prisma";
import { fetchNewEmails } from "@/lib/microsoft/email-service";
import { markAsRead } from "@/lib/microsoft/email-service";
import {
  processIncomingEmail,
  type ProcessResult,
} from "@/lib/microsoft/email-to-ticket";
import { resolveMailbox } from "@/lib/microsoft/graph-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  mailbox: string;
  emailsFetched: number;
  ticketsCreated: number;
  commentsAdded: number;
  duplicatesSkipped: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

/**
 * Run a full email sync cycle:
 * 1. Load persisted sync state (deltaLink) from the database.
 * 2. Fetch new / changed emails from the Graph API.
 * 3. Process each email through the email-to-ticket pipeline.
 * 4. Save the updated deltaLink for incremental sync next time.
 *
 * This function is safe to call repeatedly (e.g. from a cron job or API
 * endpoint). The delta query mechanism ensures only new or changed messages
 * are returned on subsequent calls.
 */
export async function syncEmails(): Promise<SyncResult> {
  const startedAt = new Date();
  const mailbox = await resolveMailbox();

  if (!mailbox) {
    throw new Error(
      "Email mailbox is not configured. " +
        "Set MS_GRAPH_MAILBOX environment variable or configure via Settings > Email Integration."
    );
  }

  console.log(`[email-sync] Starting sync for mailbox: ${mailbox}`);

  // ------------------------------------------------------------------
  // 1. Load existing sync state from the database.
  // ------------------------------------------------------------------
  let syncState = await prisma.emailSyncState.findUnique({
    where: { mailbox },
  });

  const deltaLink = syncState?.deltaLink ?? undefined;
  const lastSyncedAt = syncState?.lastSyncedAt ?? undefined;

  console.log(
    `[email-sync] Last synced: ${lastSyncedAt?.toISOString() ?? "never"}`
  );
  console.log(
    `[email-sync] Delta link available: ${deltaLink ? "yes" : "no"}`
  );

  // ------------------------------------------------------------------
  // 2. Fetch new emails from Graph using the delta query.
  // ------------------------------------------------------------------
  const sinceDate = lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { emails, deltaLink: newDeltaLink } = await fetchNewEmails(
    mailbox,
    sinceDate,
    deltaLink
  );

  console.log(`[email-sync] Fetched ${emails.length} email(s)`);

  // ------------------------------------------------------------------
  // 3. Process each email.
  // ------------------------------------------------------------------
  let ticketsCreated = 0;
  let commentsAdded = 0;
  let duplicatesSkipped = 0;
  const errors: string[] = [];

  for (const email of emails) {
    try {
      console.log(
        `[email-sync] Processing: "${email.subject}" from ${email.from}`
      );

      const result: ProcessResult = await processIncomingEmail({
        messageId: email.messageId,
        subject: email.subject,
        body: email.body,
        from: email.from,
        receivedAt: email.receivedAt,
        conversationId: email.conversationId,
      });

      switch (result.action) {
        case "ticket_created":
          ticketsCreated++;
          console.log(
            `[email-sync]   -> Created ticket #${result.ticketNumber} (${result.ticketId})`
          );
          break;
        case "comment_added":
          commentsAdded++;
          console.log(
            `[email-sync]   -> Added comment to ticket #${result.ticketNumber} (${result.ticketId})`
          );
          break;
        case "duplicate_skipped":
          duplicatesSkipped++;
          console.log(
            `[email-sync]   -> Skipped (duplicate for ticket ${result.ticketId})`
          );
          break;
      }

      // Mark the email as read in the mailbox so it does not appear as
      // unread in Outlook.
      try {
        await markAsRead(email.messageId, mailbox);
      } catch (markErr) {
        // Non-critical -- log and continue.
        console.warn(
          `[email-sync]   -> Warning: failed to mark message as read:`,
          markErr
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown processing error";
      errors.push(`${email.messageId}: ${message}`);
      console.error(
        `[email-sync]   -> Error processing email "${email.subject}":`,
        err
      );
    }
  }

  // ------------------------------------------------------------------
  // 4. Persist updated sync state.
  // ------------------------------------------------------------------
  const completedAt = new Date();

  if (syncState) {
    await prisma.emailSyncState.update({
      where: { id: syncState.id },
      data: {
        lastSyncedAt: completedAt,
        deltaLink: newDeltaLink,
      },
    });
  } else {
    await prisma.emailSyncState.create({
      data: {
        mailbox,
        lastSyncedAt: completedAt,
        deltaLink: newDeltaLink,
      },
    });
  }

  const result: SyncResult = {
    success: errors.length === 0,
    mailbox,
    emailsFetched: emails.length,
    ticketsCreated,
    commentsAdded,
    duplicatesSkipped,
    errors,
    startedAt,
    completedAt,
  };

  console.log(`[email-sync] Sync complete.`, {
    emailsFetched: result.emailsFetched,
    ticketsCreated: result.ticketsCreated,
    commentsAdded: result.commentsAdded,
    duplicatesSkipped: result.duplicatesSkipped,
    errors: result.errors.length,
    duration: `${completedAt.getTime() - startedAt.getTime()}ms`,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
// Allows running directly with `tsx src/lib/jobs/email-sync.ts` or via the
// "email:sync" npm script defined in package.json.
// ---------------------------------------------------------------------------

const isDirectExecution =
  typeof require !== "undefined" && require.main === module;

if (isDirectExecution) {
  syncEmails()
    .then((result) => {
      if (!result.success) {
        console.error("[email-sync] Completed with errors:", result.errors);
        process.exit(1);
      }
      console.log("[email-sync] Completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[email-sync] Fatal error:", err);
      process.exit(1);
    });
}
