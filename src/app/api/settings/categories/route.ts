import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Categories are stored in a simple JSON settings table
// For now, we use a lightweight approach with a settings KV store

interface CategorySettings {
  ticketCategories: string[];
  knowledgeCategories: string[];
  assetTypes: string[];
  changeTypes: string[];
}

const DEFAULT_CATEGORIES: CategorySettings = {
  ticketCategories: [
    "Network",
    "Hardware",
    "Software",
    "Email",
    "Security",
    "Backup",
    "Printing",
    "Account/Access",
    "Other",
  ],
  knowledgeCategories: [
    "Network",
    "Hardware",
    "Software",
    "Email",
    "Security",
    "Backup",
    "Printing",
    "Account/Access",
    "General",
    "How-To",
    "Policy",
  ],
  assetTypes: [
    "WORKSTATION",
    "LAPTOP",
    "SERVER",
    "NETWORK_DEVICE",
    "PRINTER",
    "MOBILE_DEVICE",
    "SOFTWARE_LICENSE",
    "OTHER",
  ],
  changeTypes: [
    "STANDARD",
    "NORMAL",
    "EMERGENCY",
  ],
};

// We store categories in the EmailSyncState table reusing a row, or
// more cleanly, we'll use a simple file-based approach via a "settings" concept.
// For simplicity, use Prisma's raw JSON field approach.
// Since we don't have a Settings model, let's add one conceptually via
// a JSON string stored per-key.

// Actually, the cleanest approach: store as a JSON blob in a text field.
// We'll create a lightweight in-memory + file store.
// For MVP: return defaults and allow overrides stored in a global variable
// that persists per-process (will reset on restart, but works for demo).

let categoryOverrides: Partial<CategorySettings> | null = null;

export async function GET() {
  try {
    const categories = {
      ...DEFAULT_CATEGORIES,
      ...categoryOverrides,
    };
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json(
        { error: "Admin or Manager access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ticketCategories, knowledgeCategories, assetTypes, changeTypes } = body;

    categoryOverrides = {
      ...(ticketCategories && { ticketCategories }),
      ...(knowledgeCategories && { knowledgeCategories }),
      ...(assetTypes && { assetTypes }),
      ...(changeTypes && { changeTypes }),
    };

    const categories = {
      ...DEFAULT_CATEGORIES,
      ...categoryOverrides,
    };

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Categories update error:", error);
    return NextResponse.json(
      { error: "Failed to update categories" },
      { status: 500 }
    );
  }
}
