import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ChangeRequestStatus,
  ChangeType,
  TicketPriority,
  ChangeRisk,
  Prisma,
} from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") as ChangeRequestStatus | null;
    const type = searchParams.get("type") as ChangeType | null;
    const clientId = searchParams.get("clientId");
    const priority = searchParams.get("priority") as TicketPriority | null;
    const risk = searchParams.get("risk") as ChangeRisk | null;
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Prisma.ChangeRequestWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (priority) {
      where.priority = priority;
    }
    if (risk) {
      where.risk = risk;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { number: { equals: parseInt(search, 10) || -1 } },
      ];
    }

    const skip = (page - 1) * limit;

    const [changeRequests, total] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          approver: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.changeRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: changeRequests,
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching change requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch change requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const {
      title,
      description,
      reason,
      type,
      priority,
      risk,
      implementationPlan,
      rollbackPlan,
      testingPlan,
      scheduledStart,
      scheduledEnd,
      clientId,
    } = body;

    // Validate required fields
    if (!title || !description || !reason || !clientId) {
      return NextResponse.json(
        {
          error: "Title, description, reason, and clientId are required",
        },
        { status: 400 }
      );
    }

    // Validate client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, isActive: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const changeRequest = await prisma.changeRequest.create({
      data: {
        title,
        description,
        reason,
        type: type || "STANDARD",
        priority: priority || "MEDIUM",
        risk: risk || "LOW",
        implementationPlan: implementationPlan || null,
        rollbackPlan: rollbackPlan || null,
        testingPlan: testingPlan || null,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        clientId,
        createdById: userId,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(changeRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating change request:", error);
    return NextResponse.json(
      { error: "Failed to create change request" },
      { status: 500 }
    );
  }
}
