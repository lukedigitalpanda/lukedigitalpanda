"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HardDrive, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortal } from "@/lib/portal-context";

interface DeviceItem {
  id: string;
  name: string;
  assetTag: string | null;
  type: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  warrantyEnd: string | null;
}

function formatType(type: string) {
  return type.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function formatStatus(status: string) {
  return status.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  IN_REPAIR: "bg-yellow-100 text-yellow-800",
  RETIRED: "bg-red-100 text-red-800",
  DISPOSED: "bg-red-100 text-red-800",
  SPARE: "bg-gray-100 text-gray-800",
};

export default function OrgDevicesPage() {
  const router = useRouter();
  const { isLoggedIn, contact, client, role } = usePortal();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) router.push("/portal/login");
    else if (role !== "admin") router.push("/portal/dashboard");
  }, [isLoggedIn, role, router]);

  useEffect(() => {
    if (!isLoggedIn || !contact || !client || role !== "admin") return;
    async function fetchDevices() {
      try {
        setLoading(true);
        const res = await fetch(`/api/portal/assets?clientId=${client!.id}`, {
          headers: { "x-portal-token": contact!.id },
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDevices(Array.isArray(data) ? data : data.assets || []);
      } catch {
        setDevices([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, [isLoggedIn, contact, client, role]);

  if (!isLoggedIn || role !== "admin") return null;

  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Our Devices</h1>
        <p className="text-sm text-gray-500 mt-0.5">All devices for {client?.name}</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">Loading devices...</CardContent></Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <HardDrive className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="font-semibold text-gray-700">No devices found</h3>
            <p className="mt-1 text-sm text-gray-500">No devices are registered for your organisation.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Asset Tag</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Make / Model</th>
                    <th className="px-4 py-3">Hostname</th>
                    <th className="px-4 py-3">Warranty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {devices.map((d) => {
                    const now = new Date();
                    const warrantyOk = d.warrantyEnd ? new Date(d.warrantyEnd) > now : false;
                    const warrantyExpired = d.warrantyEnd ? new Date(d.warrantyEnd) <= now : false;
                    const WarrantyIcon = d.warrantyEnd ? (warrantyOk ? ShieldCheck : ShieldAlert) : ShieldOff;
                    const warrantyColor = warrantyOk ? "text-green-600" : warrantyExpired ? "text-red-600" : "text-gray-400";
                    const warrantyLabel = d.warrantyEnd
                      ? warrantyOk ? "Valid" : "Expired"
                      : "N/A";

                    return (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.assetTag || "-"}</td>
                        <td className="px-4 py-3">{formatType(d.type)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={STATUS_COLORS[d.status] || ""}>{formatStatus(d.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {[d.manufacturer, d.model].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.hostname || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-medium ${warrantyColor}`}>
                            <WarrantyIcon className="h-3.5 w-3.5" /> {warrantyLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
