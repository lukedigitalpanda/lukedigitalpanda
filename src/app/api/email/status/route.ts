import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connected = !!(
      process.env.MS_GRAPH_CLIENT_ID &&
      process.env.MS_GRAPH_CLIENT_SECRET &&
      process.env.MS_GRAPH_TENANT_ID &&
      process.env.MS_GRAPH_MAILBOX
    );

    const syncState = await prisma.emailSyncState.findFirst({
      orderBy: { lastSyncedAt: "desc" },
    });

    return NextResponse.json({
      connected,
      mailbox: process.env.MS_GRAPH_MAILBOX || syncState?.mailbox || null,
      lastSyncedAt: syncState?.lastSyncedAt?.toISOString() || null,
      deltaToken: syncState?.deltaToken ? true : false,
    });
  } catch (error) {
    console.error("Email status error:", error);
    return NextResponse.json({
      connected: false,
      mailbox: null,
      lastSyncedAt: null,
    });
  }
}
