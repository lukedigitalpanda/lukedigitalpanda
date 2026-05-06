import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runNinjaRmmSync } from "@/lib/ninjarmm/ninjarmm-sync";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const result = await runNinjaRmmSync();
    return NextResponse.json({
      success: result.success,
      data: {
        orgsProcessed: result.orgsProcessed,
        clientsCreated: result.clientsCreated,
        devicesProcessed: result.devicesProcessed,
        assetsUpserted: result.assetsUpserted,
        alertsProcessed: result.alertsProcessed,
        ticketsCreated: result.ticketsCreated,
        errors: result.errors,
        durationMs:
          result.completedAt.getTime() - result.startedAt.getTime(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
