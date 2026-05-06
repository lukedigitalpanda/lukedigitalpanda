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
  try {
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
      clientId: config.clientId ?? "",
      clientSecret: config.clientSecret ? "••••••••" : "",
      lastSyncedAt: lastSyncRow?.value ?? null,
    });
  } catch (error) {
    console.error("[api/integrations/ninjarmm] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const denied = requireAdmin((session.user as any).role);
    if (denied) return denied;

    const body = (await request.json()) as Partial<NinjaRmmConfig>;
    const { clientId, clientSecret, instanceUrl, enabled } = body;

    if (!clientId || !instanceUrl) {
      return NextResponse.json(
        { error: "clientId and instanceUrl are required" },
        { status: 400 }
      );
    }

    // Load existing config to preserve secret when not re-entered
    let resolvedSecret = clientSecret;
    if (!resolvedSecret || resolvedSecret === "••••••••") {
      const existing = await prisma.settings.findUnique({
        where: { key: SETTINGS_KEY },
      });
      if (existing) {
        const existingConfig = JSON.parse(existing.value) as NinjaRmmConfig;
        resolvedSecret = existingConfig.clientSecret;
      }
    }

    if (!resolvedSecret) {
      return NextResponse.json(
        { error: "clientSecret is required" },
        { status: 400 }
      );
    }

    const config: NinjaRmmConfig = {
      clientId,
      clientSecret: resolvedSecret,
      instanceUrl,
      enabled: enabled ?? false,
    };

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(config) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/integrations/ninjarmm] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
