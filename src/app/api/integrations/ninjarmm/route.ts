import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  SETTINGS_KEY,
  LAST_SYNC_KEY,
  NinjaRmmConfig,
} from "@/lib/ninjarmm/ninjarmm-sync";

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requireAdmin((session.user as any).role);
  if (denied) return denied;

  const [configRow, lastSyncRow] = await Promise.all([
    prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
    prisma.settings.findUnique({ where: { key: LAST_SYNC_KEY } }),
  ]);

  if (!configRow) {
    return NextResponse.json({
      configured: false,
      enabled: false,
      instanceUrl: "eu.ninjarmm.com",
      clientId: "",
      clientSecret: "",
      lastSyncedAt: null,
    });
  }

  const config = JSON.parse(configRow.value) as NinjaRmmConfig;

  return NextResponse.json({
    configured: true,
    enabled: config.enabled,
    instanceUrl: config.instanceUrl,
    clientId: config.clientId
      ? config.clientId.slice(0, 4) + "••••" + config.clientId.slice(-4)
      : "",
    clientSecret: config.clientSecret ? "••••••••" : "",
    lastSyncedAt: lastSyncRow?.value ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requireAdmin((session.user as any).role);
  if (denied) return denied;

  const body = await request.json() as Partial<NinjaRmmConfig>;
  const { clientId, clientSecret, instanceUrl, enabled } = body;

  if (!clientId || !clientSecret || !instanceUrl) {
    return NextResponse.json(
      { error: "clientId, clientSecret, and instanceUrl are required" },
      { status: 400 }
    );
  }

  const config: NinjaRmmConfig = {
    clientId,
    clientSecret,
    instanceUrl,
    enabled: enabled ?? false,
  };

  await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(config) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(config) },
  });

  return NextResponse.json({ success: true });
}
