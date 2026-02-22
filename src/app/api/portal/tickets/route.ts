import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSLADeadlineAsync } from "@/lib/utils";

// POST: Public ticket creation (no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, description, priority, clientId, contactId, category } = body;

    if (!name || !email || !subject || !description) {
      return NextResponse.json(
        { error: "Name, email, subject, and description are required" },
        { status: 400 }
      );
    }

    // If contactId provided (logged-in portal user), use it directly
    let contact = contactId
      ? await prisma.clientContact.findUnique({
          where: { id: contactId },
          include: { client: true },
        })
      : await prisma.clientContact.findFirst({
          where: { email: email.toLowerCase() },
          include: { client: true },
        });

    let resolvedClientId = clientId;

    // If contact found, use their client
    if (contact) {
      resolvedClientId = contact.clientId;
    }

    // If no client could be resolved, we need a default/unassigned client
    if (!resolvedClientId) {
      // Find or create a "Walk-in / Unassigned" client
      let defaultClient = await prisma.client.findFirst({
        where: { name: "Unassigned / Walk-in" },
      });
      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: {
            name: "Unassigned / Walk-in",
            contractType: "Break-Fix",
            slaLevel: "Bronze",
            notes: "Auto-created for portal submissions without a matching client",
          },
        });
      }
      resolvedClientId = defaultClient.id;

      // Create the contact under this default client
      contact = await prisma.clientContact.create({
        data: {
          clientId: resolvedClientId,
          name,
          email: email.toLowerCase(),
          phone: phone || null,
          isPrimary: false,
        },
        include: { client: true },
      });
    }

    // If contact still doesn't exist but we have a client, create contact
    if (!contact && resolvedClientId) {
      contact = await prisma.clientContact.create({
        data: {
          clientId: resolvedClientId,
          name,
          email: email.toLowerCase(),
          phone: phone || null,
          isPrimary: false,
        },
        include: { client: true },
      });
    }

    const ticketPriority = priority || "MEDIUM";

    // Get SLA level from client
    const client = await prisma.client.findUnique({
      where: { id: resolvedClientId },
    });

    const slaDeadline = await calculateSLADeadlineAsync(ticketPriority, client?.slaLevel);

    // Find a default creator (first admin user) for the createdById field
    const systemUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!systemUser) {
      return NextResponse.json(
        { error: "System not configured - no admin user found" },
        { status: 500 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject,
        description,
        priority: ticketPriority,
        category: category || null,
        status: "OPEN",
        source: "PORTAL",
        clientId: resolvedClientId,
        contactId: contact?.id || null,
        createdById: systemUser.id,
        slaDeadline,
      },
      include: {
        client: { select: { name: true } },
      },
    });

    // Try AI classification only if no category was supplied by the user
    // (don't block the response)
    if (!category) {
      try {
        const { classifyTicket } = await import("@/lib/ai/ticket-classifier");
        const classification = await classifyTicket(subject, description);
        if (classification) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              aiCategory: classification.category,
              category: classification.category,
              aiConfidence: classification.confidence,
            },
          });
        }
      } catch {
        // AI classification is optional - don't fail the ticket creation
      }
    }

    return NextResponse.json(
      {
        id: ticket.id,
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        message: `Ticket #${ticket.number} has been created. You can track its status using your ticket number and email address.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Portal ticket creation error:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}

// GET: List tickets for authenticated client (requires clientId + token in header)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = request.headers.get("x-portal-token");
    const clientId = searchParams.get("clientId");
    const contactId = searchParams.get("contactId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!token || !clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If contactId is provided, allow any contact to view their own tickets
    // Otherwise, require primary contact (admin) for org-wide view
    if (contactId) {
      // Verify the token matches the contact and client
      const contact = await prisma.clientContact.findFirst({
        where: { id: token, clientId },
      });
      if (!contact) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
    } else {
      // Org-wide: require primary contact
      const session = await prisma.clientContact.findFirst({
        where: { id: token, clientId, isPrimary: true },
      });
      if (!session) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
    }

    const where: any = { clientId };
    if (contactId) {
      where.contactId = contactId;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignee: { select: { name: true } },
          contact: { select: { name: true, email: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Portal tickets list error:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}
