import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AssetType, AssetStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const type = searchParams.get("type") as AssetType | null;
    const status = searchParams.get("status") as AssetStatus | null;
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const where: Prisma.AssetWhereInput = {};

    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { assetTag: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { hostname: { contains: search, mode: "insensitive" } },
        { ipAddress: { contains: search, mode: "insensitive" } },
        { manufacturer: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({
      assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
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
      assetTag,
      type,
      status,
      manufacturer,
      model,
      serialNumber,
      purchaseDate,
      warrantyEnd,
      notes,
      ipAddress,
      macAddress,
      hostname,
      licenseKey,
      licenseExpiry,
      version,
      clientId,
    } = body;

    // Validate required fields
    if (!name || !type || !clientId) {
      return NextResponse.json(
        { error: "Name, type, and clientId are required" },
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

    // Check for duplicate asset tag
    if (assetTag) {
      const existingAsset = await prisma.asset.findUnique({
        where: { assetTag },
        select: { id: true },
      });
      if (existingAsset) {
        return NextResponse.json(
          { error: "Asset tag already in use" },
          { status: 409 }
        );
      }
    }

    const asset = await prisma.asset.create({
      data: {
        name,
        assetTag: assetTag || null,
        type,
        status: status || "ACTIVE",
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
        notes: notes || null,
        ipAddress: ipAddress || null,
        macAddress: macAddress || null,
        hostname: hostname || null,
        licenseKey: licenseKey || null,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        version: version || null,
        clientId,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    );
  }
}
