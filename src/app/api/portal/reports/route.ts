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

    // Verify session - allow primary contacts or CLIENT_USER accounts
    const contact = await prisma.clientContact.findFirst({
      where: { id: token, clientId },
    });
    if (!contact) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Parse date range (default: current month)
    const now = new Date();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam
      ? new Date(fromParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toParam
      ? new Date(toParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch all tickets for this client within the date range
    const tickets = await prisma.ticket.findMany({
      where: {
        clientId,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        priority: true,
        category: true,
        source: true,
        slaDeadline: true,
        slaBreached: true,
        firstResponse: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        closedAt: true,
        assignee: { select: { name: true } },
      },
    });

    // Also fetch tickets resolved in the period (may have been created earlier)
    const resolvedInPeriod = await prisma.ticket.findMany({
      where: {
        clientId,
        resolvedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        priority: true,
        category: true,
        slaDeadline: true,
        slaBreached: true,
        firstResponse: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    // De-duplicate (some tickets may be in both sets)
    const resolvedIds = new Set(resolvedInPeriod.map((t) => t.id));
    const allResolvedInPeriod = resolvedInPeriod;

    // ---- EXEC SUMMARY ----
    const ticketsCreated = tickets.length;
    const ticketsResolved = allResolvedInPeriod.length;

    // Open tickets (all time, current state)
    const currentOpenCount = await prisma.ticket.count({
      where: {
        clientId,
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "WAITING_ON_VENDOR"] },
      },
    });

    // Avg response time (hours) - only tickets with firstResponse
    const ticketsWithResponse = tickets.filter((t) => t.firstResponse);
    const avgResponseHours =
      ticketsWithResponse.length > 0
        ? ticketsWithResponse.reduce((sum, t) => {
            const diff =
              new Date(t.firstResponse!).getTime() -
              new Date(t.createdAt).getTime();
            return sum + diff / (1000 * 60 * 60);
          }, 0) / ticketsWithResponse.length
        : null;

    // Avg resolution time (hours) - for resolved tickets
    const resolvedWithTime = allResolvedInPeriod.filter((t) => t.resolvedAt);
    const avgResolutionHours =
      resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, t) => {
            const diff =
              new Date(t.resolvedAt!).getTime() -
              new Date(t.createdAt).getTime();
            return sum + diff / (1000 * 60 * 60);
          }, 0) / resolvedWithTime.length
        : null;

    // SLA compliance - tickets with deadline that weren't breached
    const ticketsWithSLA = tickets.filter((t) => t.slaDeadline);
    const slaCompliant = ticketsWithSLA.filter((t) => !t.slaBreached).length;
    const slaComplianceRate =
      ticketsWithSLA.length > 0
        ? Math.round((slaCompliant / ticketsWithSLA.length) * 100)
        : 100;

    // ---- TECHNICAL OPERATIONS ----
    // Category distribution
    const categoryMap: Record<string, number> = {};
    tickets.forEach((t) => {
      const cat = t.category || "Uncategorized";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const categoryDistribution = Object.entries(categoryMap)
      .map(([category, count]) => ({
        category,
        count,
        percentage:
          ticketsCreated > 0
            ? Math.round((count / ticketsCreated) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Priority distribution
    const priorityMap: Record<string, number> = {};
    tickets.forEach((t) => {
      priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1;
    });
    const priorityDistribution = Object.entries(priorityMap)
      .map(([priority, count]) => ({
        priority,
        count,
        percentage:
          ticketsCreated > 0
            ? Math.round((count / ticketsCreated) * 100)
            : 0,
      }))
      .sort((a, b) => {
        const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
        return order.indexOf(a.priority) - order.indexOf(b.priority);
      });

    // Status distribution
    const statusMap: Record<string, number> = {};
    tickets.forEach((t) => {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusMap)
      .map(([status, count]) => ({
        status,
        count,
        percentage:
          ticketsCreated > 0
            ? Math.round((count / ticketsCreated) * 100)
            : 0,
      }));

    // Source distribution
    const sourceMap: Record<string, number> = {};
    tickets.forEach((t) => {
      sourceMap[t.source] = (sourceMap[t.source] || 0) + 1;
    });
    const sourceDistribution = Object.entries(sourceMap)
      .map(([source, count]) => ({
        source,
        count,
        percentage:
          ticketsCreated > 0
            ? Math.round((count / ticketsCreated) * 100)
            : 0,
      }));

    // ---- SLA COMPLIANCE ----
    // Initial response SLA
    const initialResponseMet = ticketsWithResponse.filter((t) => {
      if (!t.slaDeadline) return true; // No SLA = met by default
      return new Date(t.firstResponse!).getTime() <= new Date(t.slaDeadline).getTime();
    }).length;

    // Resolution SLA
    const resolvedTicketsWithSLA = allResolvedInPeriod.filter((t) => t.slaDeadline);
    const resolutionSlaMet = resolvedTicketsWithSLA.filter(
      (t) => !t.slaBreached
    ).length;

    // Missed SLA tickets with details
    const missedSLATickets = tickets
      .filter((t) => t.slaBreached || (t.slaDeadline && new Date(t.slaDeadline) < now && !["RESOLVED", "CLOSED"].includes(t.status)))
      .map((t) => {
        let reason = "Unknown";
        if (t.slaBreached && t.resolvedAt && t.slaDeadline) {
          const overBy = new Date(t.resolvedAt).getTime() - new Date(t.slaDeadline).getTime();
          reason = `Resolved ${Math.round(overBy / (1000 * 60 * 60))}h after SLA deadline`;
        } else if (t.slaDeadline && !t.resolvedAt) {
          const overBy = now.getTime() - new Date(t.slaDeadline).getTime();
          reason = `Still open, ${Math.round(overBy / (1000 * 60 * 60))}h past SLA deadline`;
        } else if (t.slaBreached) {
          reason = "SLA deadline exceeded";
        }
        return {
          number: t.number,
          subject: t.subject,
          priority: t.priority,
          status: t.status,
          slaDeadline: t.slaDeadline,
          reason,
        };
      });

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      execSummary: {
        ticketsCreated,
        ticketsResolved,
        currentOpenCount,
        avgResponseHours: avgResponseHours !== null ? Math.round(avgResponseHours * 10) / 10 : null,
        avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
        slaComplianceRate,
      },
      technicalOperations: {
        categoryDistribution,
        priorityDistribution,
        statusDistribution,
        sourceDistribution,
      },
      slaCompliance: {
        totalWithSLA: ticketsWithSLA.length,
        compliant: slaCompliant,
        breached: ticketsWithSLA.length - slaCompliant,
        complianceRate: slaComplianceRate,
        initialResponse: {
          total: ticketsWithResponse.length,
          met: initialResponseMet,
          missed: ticketsWithResponse.length - initialResponseMet,
          rate:
            ticketsWithResponse.length > 0
              ? Math.round(
                  (initialResponseMet / ticketsWithResponse.length) * 100
                )
              : 100,
        },
        resolution: {
          total: resolvedTicketsWithSLA.length,
          met: resolutionSlaMet,
          missed: resolvedTicketsWithSLA.length - resolutionSlaMet,
          rate:
            resolvedTicketsWithSLA.length > 0
              ? Math.round(
                  (resolutionSlaMet / resolvedTicketsWithSLA.length) * 100
                )
              : 100,
        },
        missedTickets: missedSLATickets,
      },
    });
  } catch (error) {
    console.error("Portal reports error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
