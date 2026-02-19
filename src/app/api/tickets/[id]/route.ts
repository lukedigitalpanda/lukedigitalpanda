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

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: true,
        contact: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            jobTitle: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timeEntries: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { date: "desc" },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
        relatedAssets: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const userId = (session.user as any).id;
    const body = await request.json();

    // Fetch the existing ticket to compare changes
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: { select: { slaLevel: true } },
      },
    });

    if (!existingTicket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Build update data and activity logs
    const updateData: Record<string, unknown> = {};
    const activities: Array<{
      ticketId: string;
      userId: string;
      action: string;
      oldValue: string | null;
      newValue: string | null;
      details: string;
    }> = [];

    // Handle status change
    if (body.status && body.status !== existingTicket.status) {
      updateData.status = body.status;
      activities.push({
        ticketId: id,
        userId,
        action: "status_changed",
        oldValue: existingTicket.status,
        newValue: body.status,
        details: `Status changed from ${existingTicket.status} to ${body.status}`,
      });

      // Set timestamps for resolution and closure
      if (body.status === "RESOLVED" && !existingTicket.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      if (body.status === "CLOSED" && !existingTicket.closedAt) {
        updateData.closedAt = new Date();
        if (!existingTicket.resolvedAt) {
          updateData.resolvedAt = new Date();
        }
      }

      // Check SLA breach on status change to resolved/closed
      if (
        (body.status === "RESOLVED" || body.status === "CLOSED") &&
        existingTicket.slaDeadline
      ) {
        const now = new Date();
        if (now > existingTicket.slaDeadline) {
          updateData.slaBreached = true;
        }
      }

      // If reopening a closed/resolved ticket, clear resolved/closed timestamps
      if (
        (body.status === "OPEN" || body.status === "IN_PROGRESS") &&
        (existingTicket.status === "RESOLVED" || existingTicket.status === "CLOSED")
      ) {
        updateData.resolvedAt = null;
        updateData.closedAt = null;
      }
    }

    // Handle priority change
    if (body.priority && body.priority !== existingTicket.priority) {
      updateData.priority = body.priority;
      activities.push({
        ticketId: id,
        userId,
        action: "priority_changed",
        oldValue: existingTicket.priority,
        newValue: body.priority,
        details: `Priority changed from ${existingTicket.priority} to ${body.priority}`,
      });
    }

    // Handle assignee change
    if (body.assigneeId !== undefined && body.assigneeId !== existingTicket.assigneeId) {
      if (body.assigneeId) {
        const assignee = await prisma.user.findUnique({
          where: { id: body.assigneeId },
          select: { id: true, name: true, isActive: true },
        });
        if (!assignee || !assignee.isActive) {
          return NextResponse.json(
            { error: "Assignee not found or inactive" },
            { status: 400 }
          );
        }
        activities.push({
          ticketId: id,
          userId,
          action: "assigned",
          oldValue: existingTicket.assigneeId,
          newValue: body.assigneeId,
          details: `Ticket assigned to ${assignee.name}`,
        });
      } else {
        activities.push({
          ticketId: id,
          userId,
          action: "unassigned",
          oldValue: existingTicket.assigneeId,
          newValue: null,
          details: "Ticket unassigned",
        });
      }
      updateData.assigneeId = body.assigneeId || null;
    }

    // Handle other field updates
    const simpleFields = [
      "subject",
      "description",
      "category",
      "subcategory",
      "contactId",
      "slaDeadline",
    ] as const;

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Perform the update and create activities in a transaction
    const [updatedTicket] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id },
        data: updateData,
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
        },
      }),
      ...activities.map((activity) =>
        prisma.ticketActivity.create({ data: activity })
      ),
    ]);

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const userId = (session.user as any).id;
    const userName = session.user.name || session.user.email || "Unknown";

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, number: true, subject: true, status: true, priority: true, clientId: true, client: { select: { name: true } } },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Create audit log entry, then delete ticket in a transaction
    await prisma.$transaction([
      prisma.auditLog.create({
        data: {
          action: "ticket_deleted",
          entityType: "Ticket",
          entityId: id,
          details: `Ticket #${ticket.number} "${ticket.subject}" was deleted`,
          metadata: JSON.stringify({
            number: ticket.number,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            client: ticket.client?.name,
          }),
          userId,
          userName,
        },
      }),
      prisma.ticket.delete({ where: { id } }),
    ]);

    return NextResponse.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
