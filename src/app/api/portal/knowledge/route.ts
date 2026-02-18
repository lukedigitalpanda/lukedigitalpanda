import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    // Show articles that are either:
    // 1. Public (visible to everyone)
    // 2. Assigned to this specific client
    const where: any = {
      OR: [
        { isPublic: true },
        ...(clientId ? [{ clientId }] : []),
      ],
    };

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        tags: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Portal knowledge API error:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}
