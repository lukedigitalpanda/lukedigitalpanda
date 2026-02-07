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

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            slaLevel: true,
          },
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
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
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

    const existingAsset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, assetTag: true },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Check for duplicate asset tag if changing it
    if (body.assetTag && body.assetTag !== existingAsset.assetTag) {
      const duplicateTag = await prisma.asset.findUnique({
        where: { assetTag: body.assetTag },
        select: { id: true },
      });
      if (duplicateTag) {
        return NextResponse.json(
          { error: "Asset tag already in use" },
          { status: 409 }
        );
      }
    }

    const allowedFields = [
      "name",
      "assetTag",
      "type",
      "status",
      "manufacturer",
      "model",
      "serialNumber",
      "notes",
      "ipAddress",
      "macAddress",
      "hostname",
      "licenseKey",
      "version",
      "clientId",
    ] as const;

    const dateFields = ["purchaseDate", "warrantyEnd", "licenseExpiry"] as const;

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    for (const field of dateFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate client if changing clientId
    if (updateData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: updateData.clientId as string },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
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

    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    await prisma.asset.delete({ where: { id } });

    return NextResponse.json({
      message: `Asset "${asset.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
