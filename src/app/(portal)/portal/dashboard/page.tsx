"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Plus,
  Ticket,
  Building2,
  Monitor,
  HardDrive,
  BookOpen,
  FileText,
  Activity,
  Receipt,
  BarChart3,
  Package,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { usePortal } from "@/lib/portal-context";

interface TileItem {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const tiles: TileItem[] = [
  {
    label: "Report an Issue",
    description: "Submit a new support ticket",
    href: "/portal/submit",
    icon: Plus,
  },
  {
    label: "My Issues & Requests",
    description: "View your submitted tickets",
    href: "/portal/my-tickets",
    icon: Ticket,
  },
  {
    label: "Organisation Tickets",
    description: "All tickets for your organisation",
    href: "/portal/org-tickets",
    icon: Building2,
    adminOnly: true,
  },
  {
    label: "Services & Products",
    description: "View available services and products",
    href: "/portal/services",
    icon: Package,
  },
  {
    label: "Knowledge Base",
    description: "Browse help articles and guides",
    href: "/portal/knowledge",
    icon: BookOpen,
  },
  {
    label: "Documents",
    description: "Shared documents and files",
    href: "/portal/documents",
    icon: FileText,
  },
  {
    label: "Service Status",
    description: "Check current service availability",
    href: "/portal/service-status",
    icon: Activity,
  },
  {
    label: "My Quotations",
    description: "View quotes and proposals",
    href: "/portal/quotations",
    icon: Receipt,
  },
  {
    label: "My Reports",
    description: "View reports and analytics",
    href: "/portal/reports",
    icon: BarChart3,
  },
  {
    label: "My Devices",
    description: "View devices assigned to you",
    href: "/portal/my-devices",
    icon: Monitor,
  },
  {
    label: "Our Devices",
    description: "All devices in your organisation",
    href: "/portal/org-devices",
    icon: HardDrive,
    adminOnly: true,
  },
];

export default function PortalDashboardPage() {
  const router = useRouter();
  const { isLoggedIn, contact, client, role } = usePortal();

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/portal/login");
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) return null;

  const visibleTiles = tiles.filter((t) => !t.adminOnly || role === "admin");

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {contact?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {client?.name} &middot; {role === "admin" ? "Organisation Admin" : "Portal User"}
        </p>
      </div>

      {/* Tiles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{tile.label}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">{tile.description}</p>
                  {tile.adminOnly && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Lock className="h-3 w-3" />
                      Admin
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
