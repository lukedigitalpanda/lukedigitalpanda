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

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
        tickets: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
            assignee: {
              select: { id: true, name: true },
            },
          },
        },
        assets: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            assetTag: true,
            type: true,
            status: true,
            hostname: true,
            ipAddress: true,
          },
        },
        _count: {
          select: {
            contacts: true,
            tickets: true,
            assets: true,
            changeRequests: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const allowedFields = [
      "name",
      "email",
      "phone",
      "website",
      "address",
      "notes",
      "isActive",
      "contractType",
      "slaLevel",
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const userId = (session.user as any).id;
    const userName = session.user.name || session.user.email || "Unknown";

    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, contractType: true, slaLevel: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Soft delete + audit log in a transaction
    await prisma.$transaction([
      prisma.client.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.auditLog.create({
        data: {
          action: "client_deactivated",
          entityType: "Client",
          entityId: id,
          details: `Client "${client.name}" was deactivated`,
          metadata: JSON.stringify({ name: client.name, email: client.email, contractType: client.contractType, slaLevel: client.slaLevel }),
          userId,
          userName,
        },
      }),
    ]);

    return NextResponse.json({
      message: `Client "${client.name}" has been deactivated`,
    });
  } catch (error) {
    console.error("Error deactivating client:", error);
    return NextResponse.json(
      { error: "Failed to deactivate client" },
      { status: 500 }
    );
  }
}
