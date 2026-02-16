"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetClient {
  id: string;
  name: string;
}

interface Asset {
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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AssetsResponse {
  assets: Asset[];
  pagination: Pagination;
}

interface ClientOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ASSET_TYPES = [
  "WORKSTATION", "LAPTOP", "SERVER", "NETWORK_DEVICE", "PRINTER",
  "MOBILE_DEVICE", "SOFTWARE_LICENSE", "PERIPHERAL", "OTHER",
];

function formatTypeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const ASSET_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "IN_REPAIR", label: "In Repair" },
  { value: "RETIRED", label: "Retired" },
  { value: "DISPOSED", label: "Disposed" },
  { value: "SPARE", label: "Spare" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAssetType(type: string): string {
  return formatTypeLabel(type);
}

function formatAssetStatus(status: string): string {
  const found = ASSET_STATUSES.find((s) => s.value === status);
  return found ? found.label : status;
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

function getWarrantyInfo(warrantyEnd: string | null): {
  label: string;
  color: string;
  icon: typeof ShieldCheck;
} {
  if (!warrantyEnd) {
    return { label: "No Warranty", color: "text-gray-400", icon: ShieldOff };
  }
  const end = new Date(warrantyEnd);
  const now = new Date();
  if (end > now) {
    return { label: "Under Warranty", color: "text-green-600", icon: ShieldCheck };
  }
  return { label: "Expired", color: "text-red-600", icon: ShieldAlert };
}

// ---------------------------------------------------------------------------
// New Asset Form
// ---------------------------------------------------------------------------

interface NewAssetForm {
  name: string;
  assetTag: string;
  type: string;
  clientId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd: string;
  ipAddress: string;
  hostname: string;
  notes: string;
}

const initialFormState: NewAssetForm = {
  name: "",
  assetTag: "",
  type: "",
  clientId: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  warrantyEnd: "",
  ipAddress: "",
  hostname: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewAssetForm>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<string[]>(DEFAULT_ASSET_TYPES);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch assets --------------------------------------------------------
  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      const data: AssetsResponse = await res.json();
      setAssets(data.assets);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching assets:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ---- Fetch clients for the dropdown --------------------------------------
  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setClients(
        data.clients.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
    } catch {
      // silent fail for client dropdown
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [page, typeFilter, statusFilter]);

  // ---- Fetch asset types from settings ------------------------------------
  useEffect(() => {
    async function fetchAssetTypes() {
      try {
        const res = await fetch("/api/settings/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.assetTypes?.length) setAssetTypes(data.assetTypes);
        }
      } catch {
        // use defaults
      }
    }
    fetchAssetTypes();
  }, []);

  // ---- Debounced search ----------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchAssets();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // ---- Fetch clients when dialog opens ------------------------------------
  useEffect(() => {
    if (dialogOpen) {
      fetchClients();
    }
  }, [dialogOpen]);

  // ---- Submit new asset ----------------------------------------------------
  const handleSubmit = async () => {
    if (!form.name.trim() || !form.type || !form.clientId) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          assetTag: form.assetTag || null,
          type: form.type,
          clientId: form.clientId,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          serialNumber: form.serialNumber || null,
          purchaseDate: form.purchaseDate || null,
          warrantyEnd: form.warrantyEnd || null,
          ipAddress: form.ipAddress || null,
          hostname: form.hostname || null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create asset");
      }

      setForm(initialFormState);
      setDialogOpen(false);
      fetchAssets();
    } catch (err) {
      console.error("Error creating asset:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Loading state -------------------------------------------------------
  if (loading && assets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                className="w-64 pl-9"
                disabled
              />
            </div>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              New Asset
            </Button>
          </div>
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              className="w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Asset
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value === "ALL" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {assetTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {formatTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value === "ALL" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(typeFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("");
              setStatusFilter("");
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && assets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HardDrive className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No assets found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || typeFilter || statusFilter
                ? "Try adjusting your search or filters."
                : "Get started by adding your first asset."}
            </p>
            {!search && !typeFilter && !statusFilter && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assets table */}
      {assets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Asset Tag</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Manufacturer</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Warranty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assets.map((asset) => {
                    const warranty = getWarrantyInfo(asset.warrantyEnd);
                    const WarrantyIcon = warranty.icon;
                    return (
                      <tr
                        key={asset.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/assets/${asset.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {asset.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {asset.assetTag || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className={getAssetTypeBadgeColor(asset.type)}
                          >
                            {formatAssetType(asset.type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/clients/${asset.client.id}`}
                            className="text-muted-foreground hover:text-primary hover:underline"
                          >
                            {asset.client.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className={getAssetStatusColor(asset.status)}
                          >
                            {formatAssetStatus(asset.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {asset.manufacturer || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {asset.model || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "flex items-center gap-1 text-xs font-medium",
                              warranty.color
                            )}
                          >
                            <WarrantyIcon className="h-3.5 w-3.5" />
                            {warranty.label}
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} assets
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Asset Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Asset</DialogTitle>
            <DialogDescription>
              Register a new asset in the system.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="asset-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="asset-name"
                placeholder="e.g. Main File Server"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Asset Tag */}
            <div className="grid gap-2">
              <Label htmlFor="asset-tag">Asset Tag</Label>
              <Input
                id="asset-tag"
                placeholder="e.g. AST-001"
                value={form.assetTag}
                onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client */}
            <div className="grid gap-2">
              <Label>
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.clientId}
                onValueChange={(value) =>
                  setForm({ ...form, clientId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manufacturer & Model */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="asset-manufacturer">Manufacturer</Label>
                <Input
                  id="asset-manufacturer"
                  placeholder="e.g. Dell"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm({ ...form, manufacturer: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-model">Model</Label>
                <Input
                  id="asset-model"
                  placeholder="e.g. PowerEdge R740"
                  value={form.model}
                  onChange={(e) =>
                    setForm({ ...form, model: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Serial Number */}
            <div className="grid gap-2">
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input
                id="asset-serial"
                placeholder="Serial number"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
              />
            </div>

            {/* Purchase Date & Warranty End */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="asset-purchase">Purchase Date</Label>
                <Input
                  id="asset-purchase"
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) =>
                    setForm({ ...form, purchaseDate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-warranty">Warranty End</Label>
                <Input
                  id="asset-warranty"
                  type="date"
                  value={form.warrantyEnd}
                  onChange={(e) =>
                    setForm({ ...form, warrantyEnd: e.target.value })
                  }
                />
              </div>
            </div>

            {/* IP Address & Hostname */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="asset-ip">IP Address</Label>
                <Input
                  id="asset-ip"
                  placeholder="e.g. 192.168.1.100"
                  value={form.ipAddress}
                  onChange={(e) =>
                    setForm({ ...form, ipAddress: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-hostname">Hostname</Label>
                <Input
                  id="asset-hostname"
                  placeholder="e.g. SRV-FILE-01"
                  value={form.hostname}
                  onChange={(e) =>
                    setForm({ ...form, hostname: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="asset-notes">Notes</Label>
              <Textarea
                id="asset-notes"
                placeholder="Additional notes..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting || !form.name.trim() || !form.type || !form.clientId
              }
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
