import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Lookup ticket by ID - public if email matches, or authenticated client admin
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const token = request.headers.get("x-portal-token");

    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: params.id },
          { number: parseInt(params.id) || 0 },
        ],
      },
      include: {
        client: { select: { id: true, name: true } },
        contact: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
        comments: {
          where: { isInternal: false },
          include: {
            author: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Verify access: either email matches contact, or valid portal token
    const hasEmailAccess = email && ticket.contact?.email?.toLowerCase() === email.toLowerCase();

    let hasTokenAccess = false;
    if (token) {
      const contact = await prisma.clientContact.findFirst({
        where: { id: token, clientId: ticket.clientId },
      });
      hasTokenAccess = !!contact;
    }

    if (!hasEmailAccess && !hasTokenAccess) {
      return NextResponse.json(
        { error: "Access denied. Please verify your email address matches the ticket contact." },
        { status: 403 }
      );
    }

    // Return a portal-safe view (no internal notes, limited fields)
    return NextResponse.json({
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      client: ticket.client.name,
      contact: ticket.contact?.name,
      assignee: ticket.assignee?.name || "Pending Assignment",
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
      comments: ticket.comments.map((c) => ({
        id: c.id,
        author: c.author.name,
        content: c.content,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Portal ticket detail error:", error);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}
