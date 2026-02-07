"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HardDrive,
  Monitor,
  Server,
  Ticket,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Globe,
  Cpu,
  Key,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cn,
  getStatusColor,
  getPriorityColor,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  slaLevel: string | null;
}

interface AssetTicket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface AssetDetail {
  id: string;
  name: string;
  assetTag: string | null;
  type: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  notes: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  hostname: string | null;
  licenseKey: string | null;
  licenseExpiry: string | null;
  version: string | null;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  client: AssetClient;
  tickets: AssetTicket[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSET_TYPE_LABELS: Record<string, string> = {
  WORKSTATION: "Workstation",
  LAPTOP: "Laptop",
  SERVER: "Server",
  NETWORK_DEVICE: "Network Device",
  PRINTER: "Printer",
  MOBILE_DEVICE: "Mobile Device",
  SOFTWARE_LICENSE: "Software License",
  PERIPHERAL: "Peripheral",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAssetType(type: string): string {
  return ASSET_TYPE_LABELS[type] || type;
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function getAssetStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "IN_REPAIR":
      return "bg-yellow-100 text-yellow-800";
    case "RETIRED":
      return "bg-red-100 text-red-800";
    case "DISPOSED":
      return "bg-red-100 text-red-800";
    case "INACTIVE":
      return "bg-gray-100 text-gray-800";
    case "SPARE":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getAssetTypeBadgeColor(type: string): string {
  switch (type) {
    case "SERVER":
      return "bg-purple-100 text-purple-800";
    case "WORKSTATION":
      return "bg-blue-100 text-blue-800";
    case "LAPTOP":
      return "bg-indigo-100 text-indigo-800";
    case "NETWORK_DEVICE":
      return "bg-cyan-100 text-cyan-800";
    case "PRINTER":
      return "bg-teal-100 text-teal-800";
    case "MOBILE_DEVICE":
      return "bg-pink-100 text-pink-800";
    case "SOFTWARE_LICENSE":
      return "bg-amber-100 text-amber-800";
    case "PERIPHERAL":
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getAssetTypeIcon(type: string) {
  switch (type) {
    case "SERVER":
      return Server;
    case "WORKSTATION":
    case "LAPTOP":
      return Monitor;
    default:
      return HardDrive;
  }
}

function isSoftwareType(type: string): boolean {
  return type === "SOFTWARE_LICENSE";
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardContent className="py-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-6">
          <div className="h-32 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAsset() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/assets/${assetId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Asset not found");
          throw new Error("Failed to fetch asset");
        }
        const data: AssetDetail = await res.json();
        setAsset(data);
      } catch (err) {
        console.error("Error fetching asset:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (assetId) {
      fetchAsset();
    }
  }, [assetId]);

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return <DetailSkeleton />;
  }

  // ---- Error state ----------------------------------------------------------
  if (error || !asset) {
    return (
      <div className="space-y-6">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assets
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HardDrive className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-destructive">
              {error || "Asset not found"}
            </p>
            <Link href="/assets">
              <Button variant="outline" className="mt-4">
                Return to Assets
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Derived data ---------------------------------------------------------
  const TypeIcon = getAssetTypeIcon(asset.type);
  const isSoftware = isSoftwareType(asset.type);

  const warrantyStatus = (() => {
    if (!asset.warrantyEnd) {
      return { label: "No Warranty", color: "text-gray-400", Icon: ShieldOff };
    }
    const end = new Date(asset.warrantyEnd);
    const now = new Date();
    if (end > now) {
      return {
        label: `Under Warranty (until ${formatDate(asset.warrantyEnd)})`,
        color: "text-green-600",
        Icon: ShieldCheck,
      };
    }
    return {
      label: `Expired (${formatDate(asset.warrantyEnd)})`,
      color: "text-red-600",
      Icon: ShieldAlert,
    };
  })();

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/assets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assets
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <TypeIcon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={getAssetTypeBadgeColor(asset.type)}
              >
                {formatAssetType(asset.type)}
              </Badge>
              <Badge
                variant="secondary"
                className={getAssetStatusColor(asset.status)}
              >
                {formatStatusLabel(asset.status)}
              </Badge>
              {asset.assetTag && (
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {asset.assetTag}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Asset Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {/* Manufacturer */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Manufacturer
              </dt>
              <dd className="mt-1 text-sm">{asset.manufacturer || "-"}</dd>
            </div>

            {/* Model */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Model
              </dt>
              <dd className="mt-1 text-sm">{asset.model || "-"}</dd>
            </div>

            {/* Serial Number */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Serial Number
              </dt>
              <dd className="mt-1 font-mono text-sm">
                {asset.serialNumber || "-"}
              </dd>
            </div>

            {/* Client */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Client
              </dt>
              <dd className="mt-1 text-sm">
                <Link
                  href={`/clients/${asset.client.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {asset.client.name}
                </Link>
              </dd>
            </div>

            {/* Purchase Date */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Purchase Date
              </dt>
              <dd className="mt-1 text-sm">
                {asset.purchaseDate ? formatDate(asset.purchaseDate) : "-"}
              </dd>
            </div>

            {/* Warranty */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Warranty
              </dt>
              <dd className="mt-1">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium",
                    warrantyStatus.color
                  )}
                >
                  <warrantyStatus.Icon className="h-4 w-4" />
                  {warrantyStatus.label}
                </span>
              </dd>
            </div>

            {/* IP Address */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                IP Address
              </dt>
              <dd className="mt-1 font-mono text-sm">
                {asset.ipAddress || "-"}
              </dd>
            </div>

            {/* MAC Address */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                MAC Address
              </dt>
              <dd className="mt-1 font-mono text-sm">
                {asset.macAddress || "-"}
              </dd>
            </div>

            {/* Hostname */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Hostname
              </dt>
              <dd className="mt-1 font-mono text-sm">
                {asset.hostname || "-"}
              </dd>
            </div>

            {/* Created */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Registered
              </dt>
              <dd className="mt-1 text-sm">{formatDate(asset.createdAt)}</dd>
            </div>

            {/* Software-specific fields */}
            {isSoftware && (
              <>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    License Key
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    {asset.licenseKey || "-"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    License Expiry
                  </dt>
                  <dd className="mt-1 text-sm">
                    {asset.licenseExpiry
                      ? formatDate(asset.licenseExpiry)
                      : "-"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Version
                  </dt>
                  <dd className="mt-1 text-sm">{asset.version || "-"}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Notes */}
      {asset.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {asset.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Related Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Related Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asset.tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Ticket className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No tickets linked to this asset.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Subject</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Priority</th>
                    <th className="pb-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {asset.tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {ticket.number}
                        </Link>
                      </td>
                      <td className="max-w-[300px] truncate py-3 pr-4 font-medium">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant="secondary"
                          className={getStatusColor(ticket.status)}
                        >
                          {formatStatusLabel(ticket.status)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant="secondary"
                          className={getPriorityColor(ticket.priority)}
                        >
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap py-3 text-xs text-muted-foreground">
                        {formatRelativeTime(ticket.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
