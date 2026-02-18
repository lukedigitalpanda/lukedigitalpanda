import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_LOGO_SIZE = 512 * 1024; // 512KB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Admin or Manager access required" }, { status: 403 });
    }

    const client = await prisma.client.findUnique({ where: { id: params.id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const { logoDataUrl } = body;

    if (!logoDataUrl) {
      return NextResponse.json({ error: "Logo data is required" }, { status: 400 });
    }

    // Validate it's a data URL
    const dataUrlMatch = logoDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (!dataUrlMatch) {
      return NextResponse.json(
        { error: "Invalid image format. Please upload a PNG, JPEG, SVG, or WebP image." },
        { status: 400 }
      );
    }

    const mimeType = dataUrlMatch[1];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid image type. Allowed: PNG, JPEG, SVG, WebP." },
        { status: 400 }
      );
    }

    // Check approximate size (base64 is ~4/3 of original)
    const base64Data = logoDataUrl.split(",")[1];
    const approximateSize = (base64Data.length * 3) / 4;
    if (approximateSize > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { error: "Logo is too large. Maximum size is 512KB." },
        { status: 400 }
      );
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { logoUrl: logoDataUrl },
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Admin or Manager access required" }, { status: 403 });
    }

    await prisma.client.update({
      where: { id: params.id },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500 }
    );
  }
}
