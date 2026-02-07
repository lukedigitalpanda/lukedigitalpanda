"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Building2,
  Ticket,
  HardDrive,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  isActive: boolean;
  contractType: string | null;
  slaLevel: string | null;
  createdAt: string;
  updatedAt: string;
  openTicketCount: number;
  _count: {
    contacts: number;
    tickets: number;
    assets: number;
  };
}

interface ClientsResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContractTypeColor(contractType: string | null): string {
  switch (contractType) {
    case "Managed":
      return "bg-blue-100 text-blue-800";
    case "Break-Fix":
      return "bg-orange-100 text-orange-800";
    case "Project":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getSlaLevelColor(slaLevel: string | null): string {
  switch (slaLevel) {
    case "Gold":
      return "bg-yellow-100 text-yellow-800";
    case "Silver":
      return "bg-slate-200 text-slate-800";
    case "Bronze":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// ---------------------------------------------------------------------------
// New Client Form State
// ---------------------------------------------------------------------------

interface NewClientForm {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  contractType: string;
  slaLevel: string;
}

const initialFormState: NewClientForm = {
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  contractType: "",
  slaLevel: "",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="flex gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewClientForm>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch clients -------------------------------------------------------
  const fetchClients = async (searchQuery?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "100" });
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data: ClientsResponse = await res.json();
      setClients(data.clients);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // ---- Debounced search ----------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchClients(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // ---- Submit new client ---------------------------------------------------
  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          address: form.address || null,
          contractType: form.contractType || null,
          slaLevel: form.slaLevel || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create client");
      }

      setForm(initialFormState);
      setDialogOpen(false);
      fetchClients(search);
    } catch (err) {
      console.error("Error creating client:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Loading state -------------------------------------------------------
  if (loading && clients.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="w-64 pl-9"
                disabled
              />
            </div>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </div>
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
      {!loading && !error && clients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No clients found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? "Try adjusting your search terms."
                : "Get started by adding your first client."}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clients grid */}
      {clients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="h-full transition-colors hover:border-blue-300 hover:bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {client.name}
                    </CardTitle>
                    {!client.isActive && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Contact info */}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {client.email && <p className="truncate">{client.email}</p>}
                    {client.phone && <p>{client.phone}</p>}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {client.contractType && (
                      <Badge
                        variant="secondary"
                        className={getContractTypeColor(client.contractType)}
                      >
                        {client.contractType}
                      </Badge>
                    )}
                    {client.slaLevel && (
                      <Badge
                        variant="secondary"
                        className={getSlaLevelColor(client.slaLevel)}
                      >
                        {client.slaLevel} SLA
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5" />
                      {client.openTicketCount} open ticket
                      {client.openTicketCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      {client._count.assets} asset
                      {client._count.assets !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your service desk.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="client-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="Company name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="contact@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            {/* Website */}
            <div className="grid gap-2">
              <Label htmlFor="client-website">Website</Label>
              <Input
                id="client-website"
                placeholder="https://company.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="client-address">Address</Label>
              <Textarea
                id="client-address"
                placeholder="Street address, city, state, zip"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            {/* Contract Type */}
            <div className="grid gap-2">
              <Label>Contract Type</Label>
              <Select
                value={form.contractType}
                onValueChange={(value) =>
                  setForm({ ...form, contractType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Managed">Managed</SelectItem>
                  <SelectItem value="Break-Fix">Break-Fix</SelectItem>
                  <SelectItem value="Project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* SLA Level */}
            <div className="grid gap-2">
              <Label>SLA Level</Label>
              <Select
                value={form.slaLevel}
                onValueChange={(value) =>
                  setForm({ ...form, slaLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select SLA level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Bronze">Bronze</SelectItem>
                </SelectContent>
              </Select>
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
              disabled={submitting || !form.name.trim()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
