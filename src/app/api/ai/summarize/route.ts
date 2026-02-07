import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { summarizeTicket } from "@/lib/ai/ticket-summarizer";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId || typeof ticketId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'ticketId' field" },
        { status: 400 }
      );
    }

    // Fetch the ticket with its comments from the database
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        comments: {
          select: {
            content: true,
            createdAt: true,
            isInternal: true,
            author: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
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

    // Format comments for the summarizer
    const formattedComments = ticket.comments.map((comment) => ({
      content: comment.content,
      author: `${comment.author.name} (${comment.author.role}${comment.isInternal ? ", internal note" : ""})`,
      createdAt: comment.createdAt.toISOString(),
    }));

    // Generate AI summary
    const summary = await summarizeTicket({
      subject: ticket.subject,
      description: ticket.description,
      comments: formattedComments,
    });

    if (!summary) {
      return NextResponse.json(
        { error: "AI summarization failed. Please try again later." },
        { status: 502 }
      );
    }

    // Optionally persist the summary back to the ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { aiSummary: summary },
    });

    return NextResponse.json({
      ticketId: ticket.id,
      summary,
      commentCount: ticket.comments.length,
    });
  } catch (error) {
    console.error("[API /ai/summarize] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
