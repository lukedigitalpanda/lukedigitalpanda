import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sla";
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date();

    switch (type) {
      case "sla":
        return NextResponse.json(await getSLAReport(from, to));
      case "technician":
        return NextResponse.json(await getTechnicianReport(from, to));
      case "client":
        return NextResponse.json(await getClientReport(from, to));
      case "volume":
        return NextResponse.json(await getVolumeReport(from, to));
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

async function getSLAReport(from: Date, to: Date) {
  const tickets = await prisma.ticket.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      slaDeadline: { not: null },
    },
    include: {
      client: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  const total = tickets.length;
  const breached = tickets.filter((t) => t.slaBreached).length;
  const compliance = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

  // SLA by priority
  const byPriority = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((priority) => {
    const priorityTickets = tickets.filter((t) => t.priority === priority);
    const priorityBreached = priorityTickets.filter((t) => t.slaBreached).length;
    return {
      priority,
      total: priorityTickets.length,
      breached: priorityBreached,
      compliance:
        priorityTickets.length > 0
          ? Math.round(((priorityTickets.length - priorityBreached) / priorityTickets.length) * 100)
          : 100,
    };
  });

  const breachedTickets = tickets
    .filter((t) => t.slaBreached)
    .map((t) => ({
      id: t.id,
      number: t.number,
      subject: t.subject,
      client: t.client.name,
      priority: t.priority,
      slaDeadline: t.slaDeadline,
      resolvedAt: t.resolvedAt,
    }));

  return { compliance, total, breached, byPriority, breachedTickets };
}

async function getTechnicianReport(from: Date, to: Date) {
  const technicians = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIAN", "ADMIN", "MANAGER"] } },
    select: {
      id: true,
      name: true,
      assignedTickets: {
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      },
      timeEntries: {
        where: { date: { gte: from, lte: to } },
        select: { minutes: true, billable: true },
      },
    },
  });

  return technicians.map((tech) => {
    const resolved = tech.assignedTickets.filter((t) =>
      ["RESOLVED", "CLOSED"].includes(t.status)
    );
    const totalMinutes = tech.timeEntries.reduce((sum, e) => sum + e.minutes, 0);
    const billableMinutes = tech.timeEntries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.minutes, 0);

    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, t) => {
        if (t.resolvedAt) {
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
        }
        return sum;
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolved.length / 3600000) * 10) / 10;
    }

    return {
      id: tech.id,
      name: tech.name,
      ticketsAssigned: tech.assignedTickets.length,
      ticketsResolved: resolved.length,
      avgResolutionHours,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      billableHours: Math.round((billableMinutes / 60) * 10) / 10,
    };
  });
}

async function getClientReport(from: Date, to: Date) {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slaLevel: true,
      tickets: {
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          slaBreached: true,
          slaDeadline: true,
          createdAt: true,
          resolvedAt: true,
        },
      },
    },
  });

  return clients.map((client) => {
    const openTickets = client.tickets.filter(
      (t) => !["RESOLVED", "CLOSED"].includes(t.status)
    ).length;
    const withSLA = client.tickets.filter((t) => t.slaDeadline);
    const breached = withSLA.filter((t) => t.slaBreached).length;
    const slaCompliance =
      withSLA.length > 0
        ? Math.round(((withSLA.length - breached) / withSLA.length) * 100)
        : 100;

    const resolved = client.tickets.filter((t) => t.resolvedAt);
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce(
        (sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
        0
      );
      avgResolutionHours = Math.round((totalMs / resolved.length / 3600000) * 10) / 10;
    }

    return {
      id: client.id,
      name: client.name,
      slaLevel: client.slaLevel,
      totalTickets: client.tickets.length,
      openTickets,
      slaCompliance,
      avgResolutionHours,
    };
  });
}

async function getVolumeReport(from: Date, to: Date) {
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: {
      id: true,
      status: true,
      category: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const dailyVolume: Record<string, number> = {};
  tickets.forEach((t) => {
    const day = t.createdAt.toISOString().split("T")[0];
    dailyVolume[day] = (dailyVolume[day] || 0) + 1;
  });

  const volumeOverTime = Object.entries(dailyVolume).map(([date, count]) => ({
    date,
    count,
  }));

  // Group by category
  const byCategory: Record<string, number> = {};
  tickets.forEach((t) => {
    const cat = t.category || "Uncategorised";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  const categoryData = Object.entries(byCategory).map(([category, count]) => ({
    category,
    count,
  }));

  const totalCreated = tickets.length;
  const totalResolved = tickets.filter((t) =>
    ["RESOLVED", "CLOSED"].includes(t.status)
  ).length;
  const totalOpen = tickets.filter(
    (t) => !["RESOLVED", "CLOSED"].includes(t.status)
  ).length;

  return {
    volumeOverTime,
    byCategory: categoryData,
    summary: { totalCreated, totalResolved, totalOpen },
  };
}
