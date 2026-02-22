import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const SETTINGS_KEY = "email_config";

export interface EmailConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  mailbox: string;
}

export async function loadEmailConfig(): Promise<Partial<EmailConfig>> {
  // Env vars take priority over DB settings
  const fromEnv: Partial<EmailConfig> = {
    clientId: process.env.MS_GRAPH_CLIENT_ID,
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET,
    tenantId: process.env.MS_GRAPH_TENANT_ID,
    mailbox: process.env.MS_GRAPH_MAILBOX,
  };
  if (fromEnv.clientId && fromEnv.clientSecret && fromEnv.tenantId && fromEnv.mailbox) {
    return fromEnv;
  }
  // Fall back to DB
  try {
    const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    if (row) {
      const db = JSON.parse(row.value) as Partial<EmailConfig>;
      return { ...db, ...Object.fromEntries(Object.entries(fromEnv).filter(([, v]) => v)) };
    }
  } catch {}
  return fromEnv;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await loadEmailConfig();
    const isEnvConfigured = !!(
      process.env.MS_GRAPH_CLIENT_ID &&
      process.env.MS_GRAPH_CLIENT_SECRET &&
      process.env.MS_GRAPH_TENANT_ID &&
      process.env.MS_GRAPH_MAILBOX
    );

    return NextResponse.json({
      // Never expose secrets in GET - mask them
      clientId: config.clientId ? maskSecret(config.clientId) : "",
      clientSecret: config.clientSecret ? "••••••••" : "",
      tenantId: config.tenantId ? maskSecret(config.tenantId) : "",
      mailbox: config.mailbox || "",
      configured: !!(config.clientId && config.clientSecret && config.tenantId && config.mailbox),
      fromEnv: isEnvConfigured,
    });
  } catch (error) {
    console.error("Email config fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch email config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json() as Partial<EmailConfig>;
    const { clientId, clientSecret, tenantId, mailbox } = body;

    if (!clientId || !clientSecret || !tenantId || !mailbox) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const config: EmailConfig = { clientId, clientSecret, tenantId, mailbox };
    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(config) },
    });

    // Reset MSAL instance so it picks up new credentials
    const { resetMsalInstance } = await import("@/lib/microsoft/graph-client");
    resetMsalInstance();

    return NextResponse.json({ success: true, mailbox });
  } catch (error) {
    console.error("Email config update error:", error);
    return NextResponse.json({ error: "Failed to save email config" }, { status: 500 });
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}
