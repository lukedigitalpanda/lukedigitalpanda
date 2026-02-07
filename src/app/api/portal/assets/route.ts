import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = request.headers.get("x-portal-token");
    const clientId = searchParams.get("clientId");

    if (!token || !clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify token
    const contact = await prisma.clientContact.findFirst({
      where: { id: token, clientId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const assets = await prisma.asset.findMany({
      where: { clientId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        assetTag: true,
        type: true,
        status: true,
        manufacturer: true,
        model: true,
        hostname: true,
        warrantyEnd: true,
      },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Portal assets error:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}
