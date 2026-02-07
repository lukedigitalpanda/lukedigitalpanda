import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestResponse } from "@/lib/ai/ticket-suggestions";
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
    const { ticketId, subject, description, category } = body;

    let ticketSubject: string;
    let ticketDescription: string;
    let ticketCategory: string | undefined = category;

    // If ticketId is provided, fetch from the database
    if (ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          subject: true,
          description: true,
          category: true,
        },
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 }
        );
      }

      ticketSubject = ticket.subject;
      ticketDescription = ticket.description;
      ticketCategory = ticket.category ?? undefined;
    } else {
      // Use directly provided subject and description
      if (!subject || typeof subject !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid 'subject' field. Provide either 'ticketId' or 'subject' and 'description'." },
          { status: 400 }
        );
      }

      if (!description || typeof description !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid 'description' field" },
          { status: 400 }
        );
      }

      ticketSubject = subject;
      ticketDescription = description;
    }

    // Query knowledge base for relevant articles based on category and keywords
    const knowledgeArticles = await findRelevantArticles(
      ticketSubject,
      ticketDescription,
      ticketCategory
    );

    const knowledgeBase = knowledgeArticles.map(
      (article) => `Title: ${article.title}\n\n${article.content}`
    );

    // Generate AI suggestion
    const suggestion = await suggestResponse(
      {
        subject: ticketSubject,
        description: ticketDescription,
        category: ticketCategory,
      },
      knowledgeBase.length > 0 ? knowledgeBase : undefined
    );

    if (!suggestion) {
      return NextResponse.json(
        { error: "AI suggestion generation failed. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ...suggestion,
      knowledgeArticlesUsed: knowledgeArticles.map((a) => ({
        id: a.id,
        title: a.title,
      })),
    });
  } catch (error) {
    console.error("[API /ai/suggest] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Finds relevant knowledge base articles by matching the ticket's
 * category and searching for keyword overlap in the title.
 */
async function findRelevantArticles(
  subject: string,
  description: string,
  category?: string
) {
  // Extract significant keywords from the subject for search
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "it", "its", "this", "that", "not",
    "but", "and", "or", "if", "my", "our", "your", "i", "we", "they",
    "me", "us", "him", "her", "them", "up", "so", "no", "just",
  ]);

  const keywords = `${subject} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 10);

  // Build search conditions
  const searchConditions: any[] = [];

  // Match by category if available
  if (category) {
    searchConditions.push({ category: { equals: category, mode: "insensitive" as const } });
  }

  // Match by keywords in title or content
  if (keywords.length > 0) {
    searchConditions.push(
      ...keywords.map((keyword) => ({
        OR: [
          { title: { contains: keyword, mode: "insensitive" as const } },
          { content: { contains: keyword, mode: "insensitive" as const } },
          { tags: { has: keyword } },
        ],
      }))
    );
  }

  if (searchConditions.length === 0) {
    return [];
  }

  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      OR: searchConditions,
    },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
    },
    take: 5,
    orderBy: {
      updatedAt: "desc",
    },
  });

  return articles;
}
