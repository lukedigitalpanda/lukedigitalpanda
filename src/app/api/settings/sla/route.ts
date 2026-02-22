import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "sla_matrix";

export interface SLAMatrix {
  CRITICAL: { Gold: number; Silver: number; Bronze: number };
  HIGH: { Gold: number; Silver: number; Bronze: number };
  MEDIUM: { Gold: number; Silver: number; Bronze: number };
  LOW: { Gold: number; Silver: number; Bronze: number };
}

export const DEFAULT_SLA: SLAMatrix = {
  CRITICAL: { Gold: 1, Silver: 2, Bronze: 4 },
  HIGH: { Gold: 4, Silver: 8, Bronze: 16 },
  MEDIUM: { Gold: 8, Silver: 24, Bronze: 48 },
  LOW: { Gold: 24, Silver: 48, Bronze: 72 },
};

export async function loadSLAMatrix(): Promise<SLAMatrix> {
  try {
    const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    if (row) {
      return { ...DEFAULT_SLA, ...JSON.parse(row.value) } as SLAMatrix;
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_SLA;
}

export async function GET() {
  try {
    const matrix = await loadSLAMatrix();
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("SLA fetch error:", error);
    return NextResponse.json(DEFAULT_SLA);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Admin or Manager access required" }, { status: 403 });
    }

    const body = await request.json();
    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(body) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(body) },
    });

    return NextResponse.json({ ...DEFAULT_SLA, ...body });
  } catch (error) {
    console.error("SLA update error:", error);
    return NextResponse.json({ error: "Failed to update SLA matrix" }, { status: 500 });
  }
}
