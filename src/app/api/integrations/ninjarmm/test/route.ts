import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NinjaRmmClient } from "@/lib/ninjarmm/ninjarmm-client";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await request.json() as {
      clientId: string;
      clientSecret: string;
      instanceUrl: string;
    };
    const { clientId, clientSecret, instanceUrl } = body;

    if (!clientId || !clientSecret || !instanceUrl) {
      return NextResponse.json(
        { success: false, error: "clientId, clientSecret, and instanceUrl are required" },
        { status: 400 }
      );
    }

    const client = new NinjaRmmClient({ clientId, clientSecret, instanceUrl });
    await client.testConnection();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/integrations/ninjarmm/test] POST error:", err);
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
