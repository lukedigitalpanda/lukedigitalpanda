import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncEmails } from "@/lib/jobs/email-sync";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/email/sync -- Trigger an email sync
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // Authenticate: only logged-in users with ADMIN or MANAGER role may trigger.
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      );
    }

    const result = await syncEmails();

    return NextResponse.json({
      success: result.success,
      data: {
        mailbox: result.mailbox,
        emailsFetched: result.emailsFetched,
        ticketsCreated: result.ticketsCreated,
        commentsAdded: result.commentsAdded,
        duplicatesSkipped: result.duplicatesSkipped,
        errors: result.errors,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt.toISOString(),
        durationMs:
          result.completedAt.getTime() - result.startedAt.getTime(),
      },
    });
  } catch (err) {
    console.error("[api/email/sync] POST error:", err);

    const message =
      err instanceof Error ? err.message : "Internal server error";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/email/sync -- Get sync status
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    // Authenticate.
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mailbox = process.env.MS_GRAPH_MAILBOX;
    if (!mailbox) {
      return NextResponse.json(
        {
          configured: false,
          error: "MS_GRAPH_MAILBOX environment variable is not set.",
        },
        { status: 200 }
      );
    }

    const syncState = await prisma.emailSyncState.findUnique({
      where: { mailbox },
    });

    if (!syncState) {
      return NextResponse.json({
        configured: true,
        mailbox,
        lastSyncedAt: null,
        hasDeltaLink: false,
        message: "Email sync has not run yet for this mailbox.",
      });
    }

    return NextResponse.json({
      configured: true,
      mailbox,
      lastSyncedAt: syncState.lastSyncedAt?.toISOString() ?? null,
      hasDeltaLink: Boolean(syncState.deltaLink),
      updatedAt: syncState.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[api/email/sync] GET error:", err);

    const message =
      err instanceof Error ? err.message : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
