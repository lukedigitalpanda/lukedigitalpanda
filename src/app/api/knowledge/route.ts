import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [articles, total] = await Promise.all([
      prisma.knowledgeArticle.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { name: true, image: true } },
        },
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);

    return NextResponse.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Knowledge API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, tags, isPublic, authorId } = body;

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: "Title, content, and author are required" },
        { status: 400 }
      );
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        category: category || null,
        tags: tags || [],
        isPublic: isPublic || false,
        authorId,
      },
      include: {
        author: { select: { name: true, image: true } },
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("Knowledge create error:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}
