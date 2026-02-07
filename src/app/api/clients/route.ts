import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");
    const contractType = searchParams.get("contractType");
    const slaLevel = searchParams.get("slaLevel");

    const where: Prisma.ClientWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    if (contractType) {
      where.contractType = contractType;
    }

    if (slaLevel) {
      where.slaLevel = slaLevel;
    }

    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          _count: {
            select: {
              contacts: true,
              tickets: true,
              assets: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    // Fetch open ticket counts for each client
    const clientIds = clients.map((c) => c.id);
    const openTicketCounts = await prisma.ticket.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clientIds },
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "WAITING_ON_VENDOR"] },
      },
      _count: { id: true },
    });

    const openTicketMap = new Map(
      openTicketCounts.map((item) => [item.clientId, item._count.id])
    );

    const clientsWithCounts = clients.map((client) => ({
      ...client,
      openTicketCount: openTicketMap.get(client.id) || 0,
    }));

    return NextResponse.json({
      clients: clientsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
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

    const body = await request.json();
    const {
      name,
      email,
      phone,
      website,
      address,
      notes,
      contractType,
      slaLevel,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        website: website || null,
        address: address || null,
        notes: notes || null,
        contractType: contractType || null,
        slaLevel: slaLevel || null,
      },
      include: {
        _count: {
          select: {
            contacts: true,
            tickets: true,
            assets: true,
          },
        },
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
