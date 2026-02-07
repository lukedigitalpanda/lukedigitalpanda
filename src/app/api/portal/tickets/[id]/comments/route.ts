import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { content, email } = body;

    if (!content || !email) {
      return NextResponse.json(
        { error: "Content and email are required" },
        { status: 400 }
      );
    }

    // Find the ticket
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: params.id },
          { number: parseInt(params.id) || 0 },
        ],
      },
      include: { contact: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Verify access via email or portal token
    const token = request.headers.get("x-portal-token");
    const hasEmailAccess = ticket.contact?.email?.toLowerCase() === email.toLowerCase();

    let hasTokenAccess = false;
    if (token) {
      const contact = await prisma.clientContact.findFirst({
        where: { id: token, clientId: ticket.clientId },
      });
      hasTokenAccess = !!contact;
    }

    if (!hasEmailAccess && !hasTokenAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Find the system user to attribute the comment (or find a client user)
    const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!systemUser) {
      return NextResponse.json({ error: "System not configured" }, { status: 500 });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: systemUser.id,
        content: `[Portal - ${email}]: ${content}`,
        isInternal: false,
      },
    });

    // If ticket was waiting on client, reopen it
    if (ticket.status === "WAITING_ON_CLIENT") {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "OPEN" },
      });
    }

    return NextResponse.json({ success: true, commentId: comment.id }, { status: 201 });
  } catch (error) {
    console.error("Portal comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
