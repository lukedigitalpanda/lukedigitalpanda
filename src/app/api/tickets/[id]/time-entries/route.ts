import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: { ticketId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Calculate totals
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const billableMinutes = timeEntries.reduce(
      (sum, entry) => sum + (entry.billable ? entry.minutes : 0),
      0
    );

    return NextResponse.json({
      timeEntries,
      summary: {
        totalMinutes,
        billableMinutes,
        nonBillableMinutes: totalMinutes - billableMinutes,
        totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
        billableHours: parseFloat((billableMinutes / 60).toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const userId = (session.user as any).id;
    const body = await request.json();
    const { minutes, description, billable, date } = body;

    // Validate required fields
    if (!minutes || typeof minutes !== "number" || minutes <= 0) {
      return NextResponse.json(
        { error: "Minutes must be a positive number" },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, number: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Create time entry and log activity
    const [timeEntry] = await prisma.$transaction([
      prisma.timeEntry.create({
        data: {
          ticketId: id,
          userId,
          minutes,
          description: description || null,
          billable: billable !== undefined ? billable : true,
          date: date ? new Date(date) : new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      prisma.ticketActivity.create({
        data: {
          ticketId: id,
          userId,
          action: "time_logged",
          newValue: `${minutes}`,
          details: `Logged ${minutes} minutes${billable === false ? " (non-billable)" : ""}`,
        },
      }),
    ]);

    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    console.error("Error creating time entry:", error);
    return NextResponse.json(
      { error: "Failed to create time entry" },
      { status: 500 }
    );
  }
}
