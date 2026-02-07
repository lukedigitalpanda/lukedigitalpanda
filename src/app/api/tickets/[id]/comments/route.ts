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

    const userRole = (session.user as any).role;

    // If the user is a CLIENT_USER, filter out internal notes
    const where: Record<string, unknown> = { ticketId: id };
    if (userRole === "CLIENT_USER") {
      where.isInternal = false;
    }

    const comments = await prisma.ticketComment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
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
    const { content, isInternal } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, number: true, firstResponse: true, assigneeId: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Create comment and log activity in a transaction
    const [comment] = await prisma.$transaction([
      prisma.ticketComment.create({
        data: {
          ticketId: id,
          authorId: userId,
          content: content.trim(),
          isInternal: isInternal || false,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            },
          },
        },
      }),
      prisma.ticketActivity.create({
        data: {
          ticketId: id,
          userId,
          action: isInternal ? "internal_note_added" : "comment_added",
          details: isInternal ? "Internal note added" : "Comment added",
        },
      }),
      // Set first response time if this is the first non-internal comment
      // from a technician and firstResponse is not yet set
      ...((!ticket.firstResponse && !isInternal)
        ? [
            prisma.ticket.update({
              where: { id },
              data: { firstResponse: new Date() },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
