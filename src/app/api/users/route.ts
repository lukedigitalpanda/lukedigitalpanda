import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    const where: any = {};
    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        isActive: true,
        image: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
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

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, jobTitle, clientId } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // CLIENT_USER must be associated with a client
    if (role === "CLIENT_USER" && !clientId) {
      return NextResponse.json(
        { error: "Client user must be associated with a client company" },
        { status: 400 }
      );
    }

    // Verify the client exists if clientId is provided
    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return NextResponse.json(
          { error: "The selected client company does not exist" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password, // TODO: bcrypt hash in production
        role: role || "TECHNICIAN",
        jobTitle: jobTitle || null,
        clientId: role === "CLIENT_USER" ? clientId : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        isActive: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
