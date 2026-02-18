import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const clientId = (session.user as any).clientId;

    if (userRole !== "CLIENT_USER" || !clientId) {
      return NextResponse.json({ error: "Portal access requires a client user account" }, { status: 403 });
    }

    // Fetch client details with logo
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        slaLevel: true,
        contractType: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch tickets for this client
    const [tickets, openCount, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where: { clientId },
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.ticket.count({
        where: {
          clientId,
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "WAITING_ON_VENDOR"] },
        },
      }),
      prisma.ticket.count({ where: { clientId } }),
    ]);

    // Count by status
    const statusCounts = await prisma.ticket.groupBy({
      by: ["status"],
      where: { clientId },
      _count: { id: true },
    });

    const ticketsByStatus = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      client,
      tickets,
      stats: {
        openTickets: openCount,
        totalTickets: totalCount,
        ticketsByStatus,
      },
    });
  } catch (error) {
    console.error("Portal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portal data" },
      { status: 500 }
    );
  }
}
