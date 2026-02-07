import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Client admin login - verifies the contact is a primary contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find a primary contact with this email
    const contact = await prisma.clientContact.findFirst({
      where: {
        email: email.toLowerCase(),
        isPrimary: true,
      },
      include: {
        client: {
          select: { id: true, name: true, slaLevel: true, contractType: true },
        },
      },
    });

    if (!contact) {
      // Also check non-primary contacts for basic access
      const basicContact = await prisma.clientContact.findFirst({
        where: { email: email.toLowerCase() },
        include: {
          client: {
            select: { id: true, name: true, slaLevel: true, contractType: true },
          },
        },
      });

      if (!basicContact) {
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
