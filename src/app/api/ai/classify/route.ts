import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { classifyTicket } from "@/lib/ai/ticket-classifier";

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

    // Parse and validate request body
    const body = await request.json();
    const { subject, description } = body;

    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'subject' field" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'description' field" },
        { status: 400 }
      );
    }

    // Classify the ticket using AI
    const classification = await classifyTicket(subject, description);

    if (!classification) {
      return NextResponse.json(
        { error: "AI classification failed. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json(classification);
  } catch (error) {
    console.error("[API /ai/classify] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
