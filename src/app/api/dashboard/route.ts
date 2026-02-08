import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Parallel queries for dashboard stats
    const [
      openTickets,
      inProgressTickets,
      ticketsByStatus,
      ticketsByPriority,
      recentTickets,
      slaBreachedCount,
      totalResolvedCount,
      ticketsThisWeek,
      ticketsLastWeek,
      avgResolutionTime,
      slaAtRiskTickets,
    ] = await Promise.all([
      // Open tickets count
      prisma.ticket.count({ where: { status: "OPEN" } }),

      // In-progress tickets count
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),

      // Tickets by status
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Tickets by priority
      prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      }),

      // Recent tickets
      prisma.ticket.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          assignee: { select: { name: true } },
        },
      }),

      // SLA breached count
      prisma.ticket.count({
        where: {
          slaBreached: true,
          status: { notIn: ["CLOSED", "RESOLVED"] },
        },
      }),

      // Total resolved (for SLA compliance calc)
      prisma.ticket.count({
        where: {
          status: { in: ["RESOLVED", "CLOSED"] },
          slaDeadline: { not: null },
        },
      }),

      // Tickets created this week
      prisma.ticket.count({
        where: { createdAt: { gte: weekAgo } },
      }),

      // Tickets created last week
      prisma.ticket.count({
        where: {
          createdAt: { gte: twoWeeksAgo, lt: weekAgo },
        },
      }),

      // Average resolution time (resolved tickets)
      prisma.ticket.findMany({
        where: {
          resolvedAt: { not: null },
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, resolvedAt: true },
      }),

      // SLA at-risk tickets
      prisma.ticket.findMany({
        where: {
          status: { notIn: ["CLOSED", "RESOLVED"] },
          slaDeadline: { not: null },
          slaBreached: false,
        },
        orderBy: { slaDeadline: "asc" },
        take: 10,
        include: {
          client: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Calculate average resolution time in hours
    let avgResolutionHours = 0;
    if (avgResolutionTime.length > 0) {
      const totalMs = avgResolutionTime.reduce((sum, t) => {
        return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionHours = Math.round(totalMs / avgResolutionTime.length / 3600000 * 10) / 10;
    }

    // SLA compliance percentage
    const slaCompliance =
      totalResolvedCount > 0
        ? Math.round(((totalResolvedCount - slaBreachedCount) / totalResolvedCount) * 100)
        : 100;

    // Format tickets by status for charts
    const statusData = ticketsByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    const priorityData = ticketsByPriority.map((p) => ({
      priority: p.priority,
      count: p._count.id,
    }));

    // Filter SLA at-risk (within next 4 hours)
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const atRiskTickets = slaAtRiskTickets.filter(
      (t) => t.slaDeadline && t.slaDeadline <= fourHoursFromNow
    );

    return NextResponse.json({
      stats: {
        openTickets,
        inProgressTickets,
        slaCompliancePercent: slaCompliance,
        avgResolutionTimeHours: avgResolutionHours,
        ticketsThisWeek,
        ticketsLastWeek,
        slaBreachedCount,
      },
      ticketsByStatus: statusData,
      ticketsByPriority: priorityData,
      recentTickets,
      slaAtRisk: atRiskTickets,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
