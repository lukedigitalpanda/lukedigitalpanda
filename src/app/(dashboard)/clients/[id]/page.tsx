"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Ticket,
  HardDrive,
  Users,
  Plus,
  Mail,
  Phone,
  Star,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface ClientContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClientTicket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  assignee: {
    id: string;
    name: string;
  } | null;
}

interface ClientAsset {
  id: string;
  name: string;
  assetTag: string | null;
  type: string;
  status: string;
  hostname: string | null;
  ipAddress: string | null;
}

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  contractType: string | null;
  slaLevel: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: ClientContact[];
  tickets: ClientTicket[];
  assets: ClientAsset[];
  _count: {
    contacts: number;
    tickets: number;
    assets: number;
    changeRequests: number;
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
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatAssetType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
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
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-6">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-8">
          <div className="h-64 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchClient() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/clients/${clientId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Client not found");
          throw new Error("Failed to fetch client");
        }
        const data: ClientDetail = await res.json();
        setClient(data);
      } catch (err) {
        console.error("Error fetching client:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  async function handleDeleteClient() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete client");
      }
      router.push("/clients");
    } catch (err) {
      console.error("Delete client error:", err);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return <DetailSkeleton />;
  }

  // ---- Error state ----------------------------------------------------------
  if (error || !client) {
    return (
      <div className="space-y-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium text-destructive">
              {error || "Client not found"}
            </p>
            <Link href="/clients">
              <Button variant="outline" className="mt-4">
                Return to Clients
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Count open tickets
  const openTicketCount = client.tickets.filter(
    (t) =>
      t.status === "OPEN" ||
      t.status === "IN_PROGRESS" ||
      t.status === "WAITING_ON_CLIENT" ||
      t.status === "WAITING_ON_VENDOR"
  ).length;

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Building2 className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {client.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
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
              {!client.isActive && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Edit Client</Button>
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remove Client
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{client.name}</strong>? This will deactivate the client and they will no longer appear in active views. Their tickets and data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Remove Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets ({client._count.tickets})
          </TabsTrigger>
          <TabsTrigger value="assets">
            Assets ({client._count.assets})
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({client._count.contacts})
          </TabsTrigger>
        </TabsList>

        {/* ---- Overview Tab ------------------------------------------------- */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Open Tickets
                  </CardTitle>
                  <div className="rounded-md bg-blue-100 p-2 text-blue-700">
                    <Ticket className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{openTicketCount}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {client._count.tickets} total tickets
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Assets
                  </CardTitle>
                  <div className="rounded-md bg-green-100 p-2 text-green-700">
                    <HardDrive className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {client._count.assets}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Managed assets
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Contacts
                  </CardTitle>
                  <div className="rounded-md bg-purple-100 p-2 text-purple-700">
                    <Users className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {client._count.contacts}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Client contacts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Client details card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Client Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {client.email && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Email
                      </dt>
                      <dd className="mt-1 text-sm">{client.email}</dd>
                    </div>
                  )}
                  {client.phone && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Phone
                      </dt>
                      <dd className="mt-1 text-sm">{client.phone}</dd>
                    </div>
                  )}
                  {client.website && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Website
                      </dt>
                      <dd className="mt-1 text-sm">
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {client.website}
                        </a>
                      </dd>
                    </div>
                  )}
                  {client.address && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Address
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-sm">
                        {client.address}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Created
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(client.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Last Updated
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatRelativeTime(client.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Tickets Tab -------------------------------------------------- */}
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Recent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Ticket className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No tickets found for this client.
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
                        <th className="pb-3 pr-4">Assignee</th>
                        <th className="pb-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {client.tickets.map((ticket) => (
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
                          <td className="max-w-[250px] truncate py-3 pr-4 font-medium">
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
                          <td className="py-3 pr-4 text-muted-foreground">
                            {ticket.assignee?.name || "Unassigned"}
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
        </TabsContent>

        {/* ---- Assets Tab --------------------------------------------------- */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {client.assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <HardDrive className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No assets found for this client.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 pr-4">Name</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Hostname</th>
                        <th className="pb-3">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {client.assets.map((asset) => (
                        <tr
                          key={asset.id}
                          className="transition-colors hover:bg-muted/50"
                        >
                          <td className="py-3 pr-4 font-medium">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {asset.name}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="secondary">
                              {formatAssetType(asset.type)}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="secondary"
                              className={getAssetStatusColor(asset.status)}
                            >
                              {formatStatusLabel(asset.status)}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                            {asset.hostname || "-"}
                          </td>
                          <td className="py-3 font-mono text-xs text-muted-foreground">
                            {asset.ipAddress || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Contacts Tab ------------------------------------------------- */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Contacts
              </CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              {client.contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No contacts found for this client.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {client.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-start justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">
                            {contact.name}
                          </h4>
                          {contact.isPrimary && (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-100 text-yellow-800"
                            >
                              <Star className="mr-1 h-3 w-3" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        {contact.jobTitle && (
                          <p className="text-xs text-muted-foreground">
                            {contact.jobTitle}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </span>
                          {contact.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
