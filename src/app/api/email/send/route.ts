import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/microsoft/email-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, ticketId, inReplyTo, authorId } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    // Send email via Microsoft Graph
    const result = await sendEmail(to, subject, emailBody, inReplyTo);

    // If linked to a ticket, create a comment record
    if (ticketId && authorId) {
      await prisma.ticketComment.create({
        data: {
          ticketId,
          authorId,
          content: emailBody,
          isInternal: false,
          isEmail: true,
        },
      });
    }

    return NextResponse.json({ success: true, messageId: result });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
