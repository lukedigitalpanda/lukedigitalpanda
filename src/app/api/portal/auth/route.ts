import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Client portal login
// Supports two flows:
// 1. Email-only (existing ClientContact lookup)
// 2. Email + password (CLIENT_USER account created by admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // If password is provided, check for CLIENT_USER account first
    if (password) {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          client: {
            select: { id: true, name: true, slaLevel: true, contractType: true, logoUrl: true },
          },
        },
      });

      if (user && user.role === "CLIENT_USER" && user.isActive && user.clientId && user.client) {
        // Verify password (plaintext for dev, TODO: bcrypt in production)
        const isValid = user.passwordHash && password === user.passwordHash;
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid email or password." },
            { status: 401 }
          );
        }

        return NextResponse.json({
          token: user.id,
          contact: {
            id: user.id,
            name: user.name,
            email: user.email,
            isPrimary: true,
          },
          client: user.client,
          role: "admin",
        });
      }
    }

    // Fallback: existing email-only ClientContact lookup
    const contact = await prisma.clientContact.findFirst({
      where: {
        email: normalizedEmail,
        isPrimary: true,
      },
      include: {
        client: {
          select: { id: true, name: true, slaLevel: true, contractType: true, logoUrl: true },
        },
      },
    });

    if (!contact) {
      // Also check non-primary contacts for basic access
      const basicContact = await prisma.clientContact.findFirst({
        where: { email: normalizedEmail },
        include: {
          client: {
            select: { id: true, name: true, slaLevel: true, contractType: true, logoUrl: true },
          },
        },
      });

      if (!basicContact) {
        // Check if a CLIENT_USER exists but no password was provided
        const clientUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (clientUser && clientUser.role === "CLIENT_USER") {
          return NextResponse.json(
            { error: "Password is required for this account.", requiresPassword: true },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: "No account found with this email address. Please contact your IT provider." },
          { status: 404 }
        );
      }

      // Non-primary contacts get limited access
      return NextResponse.json({
        token: basicContact.id,
        contact: {
          id: basicContact.id,
          name: basicContact.name,
          email: basicContact.email,
          isPrimary: false,
        },
        client: basicContact.client,
        role: "user",
      });
    }

    // Primary contacts get full client admin access
    return NextResponse.json({
      token: contact.id,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        isPrimary: true,
      },
      client: contact.client,
      role: "admin",
    });
  } catch (error) {
    console.error("Portal auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
