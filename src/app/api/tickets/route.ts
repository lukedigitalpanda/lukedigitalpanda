import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TicketStatus, TicketPriority, Prisma } from "@prisma/client";

// SLA deadline hours by priority and client SLA level
const SLA_HOURS: Record<string, Record<string, number>> = {
  Gold: {
    CRITICAL: 2,
    HIGH: 4,
    MEDIUM: 8,
    LOW: 24,
  },
  Silver: {
    CRITICAL: 4,
    HIGH: 8,
    MEDIUM: 24,
    LOW: 48,
  },
  Bronze: {
    CRITICAL: 8,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72,
  },
};

const DEFAULT_SLA_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 48,
};

function calculateSlaDeadline(priority: string, slaLevel: string | null): Date {
  const hours =
    (slaLevel && SLA_HOURS[slaLevel]?.[priority]) ||
    DEFAULT_SLA_HOURS[priority] ||
    24;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") as TicketStatus | null;
    const priority = searchParams.get("priority") as TicketPriority | null;
    const clientId = searchParams.get("clientId");
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Prisma.TicketWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { number: { equals: parseInt(search, 10) || -1 } },
      ];
    }

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, slaLevel: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
          contact: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { comments: true, timeEntries: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      subject,
      description,
      priority,
      category,
      subcategory,
      source,
      clientId,
      contactId,
      assigneeId,
    } = body;

    // Validate required fields
    if (!subject || !clientId) {
      return NextResponse.json(
        { error: "Subject and clientId are required" },
        { status: 400 }
      );
    }

    // Validate client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, slaLevel: true, isActive: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.isActive) {
      return NextResponse.json(
        { error: "Cannot create ticket for inactive client" },
        { status: 400 }
      );
    }

    // Validate assignee if provided
    if (assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, isActive: true },
      });
      if (!assignee || !assignee.isActive) {
        return NextResponse.json(
          { error: "Assignee not found or inactive" },
          { status: 400 }
        );
      }
    }

    // Validate contact if provided
    if (contactId) {
      const contact = await prisma.clientContact.findFirst({
        where: { id: contactId, clientId },
      });
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found for this client" },
          { status: 400 }
        );
      }
    }

    const ticketPriority = priority || "MEDIUM";
    const slaDeadline = calculateSlaDeadline(ticketPriority, client.slaLevel);

    const userId = (session.user as any).id;

    const ticket = await prisma.ticket.create({
      data: {
        subject,
        description: description || "",
        priority: ticketPriority,
        category: category || null,
        subcategory: subcategory || null,
        source: source || "MANUAL",
        clientId,
        contactId: contactId || null,
        assigneeId: assigneeId || null,
        createdById: userId,
        slaDeadline,
      },
      include: {
        client: {
          select: { id: true, name: true, slaLevel: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
        contact: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log creation activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        userId,
        action: "ticket_created",
        newValue: ticket.status,
        details: `Ticket #${ticket.number} created`,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
