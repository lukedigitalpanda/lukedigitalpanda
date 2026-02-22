import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { loadEmailConfig } from "@/app/api/settings/email/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await loadEmailConfig();
    const connected = !!(config.clientId && config.clientSecret && config.tenantId && config.mailbox);

    const syncState = await prisma.emailSyncState.findFirst({
      orderBy: { lastSyncedAt: "desc" },
    });

    return NextResponse.json({
      connected,
      mailbox: config.mailbox || null,
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
