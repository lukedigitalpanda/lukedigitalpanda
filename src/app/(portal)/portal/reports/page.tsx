"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePortal } from "@/lib/portal-context";

export default function PortalReportsPage() {
  const router = useRouter();
  const { isLoggedIn } = usePortal();

  useEffect(() => {
    if (!isLoggedIn) router.push("/portal/login");
  }, [isLoggedIn, router]);

  if (!isLoggedIn) return null;

  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>

      <Card>
        <CardContent className="flex flex-col items-center py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="font-semibold text-gray-700">No reports available</h3>
          <p className="mt-1 text-sm text-gray-500 text-center max-w-sm">
            Monthly service reports and SLA performance summaries will appear here once generated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
