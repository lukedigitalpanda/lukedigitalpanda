"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Monitor, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
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

export default function MyDevicesPage() {
  const router = useRouter();
  const { isLoggedIn, contact, client } = usePortal();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) router.push("/portal/login");
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !contact || !client) return;
    async function fetchDevices() {
      try {
        setLoading(true);
        const res = await fetch(`/api/portal/assets?clientId=${client!.id}&contactName=${encodeURIComponent(contact!.name)}`, {
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
  }, [isLoggedIn, contact, client]);

  if (!isLoggedIn) return null;

  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">My Devices</h1>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">Loading devices...</CardContent></Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Monitor className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="font-semibold text-gray-700">No devices found</h3>
            <p className="mt-1 text-sm text-gray-500">No devices are currently assigned to you.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => {
            const now = new Date();
            const warrantyOk = d.warrantyEnd ? new Date(d.warrantyEnd) > now : false;
            const warrantyExpired = d.warrantyEnd ? new Date(d.warrantyEnd) <= now : false;
            const WarrantyIcon = d.warrantyEnd ? (warrantyOk ? ShieldCheck : ShieldAlert) : ShieldOff;
            const warrantyColor = warrantyOk ? "text-green-600" : warrantyExpired ? "text-red-600" : "text-gray-400";
            const warrantyLabel = d.warrantyEnd
              ? warrantyOk ? `Until ${new Date(d.warrantyEnd).toLocaleDateString()}` : "Expired"
              : "No Warranty";

            return (
              <Card key={d.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{d.name}</h3>
                      {d.assetTag && <p className="text-xs font-mono text-gray-400">{d.assetTag}</p>}
                    </div>
                    <Badge variant="secondary" className={STATUS_COLORS[d.status] || ""}>{formatStatus(d.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-500">Type</span>
                    <span className="text-gray-900">{formatType(d.type)}</span>
                    {d.manufacturer && <><span className="text-gray-500">Make</span><span className="text-gray-900">{d.manufacturer}</span></>}
                    {d.model && <><span className="text-gray-500">Model</span><span className="text-gray-900">{d.model}</span></>}
                    {d.hostname && <><span className="text-gray-500">Hostname</span><span className="text-gray-900 font-mono text-xs">{d.hostname}</span></>}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${warrantyColor}`}>
                    <WarrantyIcon className="h-3.5 w-3.5" />
                    {warrantyLabel}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
