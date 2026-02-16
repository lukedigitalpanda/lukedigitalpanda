"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const services = [
  { name: "Email & Microsoft 365", status: "operational" },
  { name: "Cloud Infrastructure", status: "operational" },
  { name: "Network Services", status: "operational" },
  { name: "VoIP / Telephony", status: "operational" },
  { name: "Backup & Disaster Recovery", status: "operational" },
  { name: "Security & Monitoring", status: "operational" },
];

export default function ServiceStatusPage() {
  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Service Status</h1>
        <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          All Systems Operational
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{svc.name}</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Operational
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
