import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

const SETTINGS_KEY = "categories";

async function loadCategories(): Promise<CategorySettings> {
  try {
    const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
    if (row) {
      const saved = JSON.parse(row.value) as Partial<CategorySettings>;
      return { ...DEFAULT_CATEGORIES, ...saved };
    }
  } catch {
    // Fall back to defaults on error
  }
  return DEFAULT_CATEGORIES;
}

export async function GET() {
  try {
    const categories = await loadCategories();
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

    const overrides: Partial<CategorySettings> = {
      ...(ticketCategories && { ticketCategories }),
      ...(knowledgeCategories && { knowledgeCategories }),
      ...(assetTypes && { assetTypes }),
      ...(changeTypes && { changeTypes }),
    };

    // Persist to database
    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(overrides) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(overrides) },
    });

    const categories = { ...DEFAULT_CATEGORIES, ...overrides };
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Categories update error:", error);
    return NextResponse.json(
      { error: "Failed to update categories" },
      { status: 500 }
    );
  }
}
