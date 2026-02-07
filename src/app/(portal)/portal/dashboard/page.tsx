"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ticket,
  HardDrive,
  Plus,
  Send,
  Clock,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, getStatusColor, getPriorityColor, formatDate } from "@/lib/utils";
import { usePortal } from "../../layout";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TicketRow {
  id: string;
  number: number;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  contact?: { name: string; email: string } | null;
  assignee?: { name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AssetRow {
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

interface TicketSubmitResult {
  number: number;
  subject: string;
  message: string;
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function PortalDashboardPage() {
  const router = useRouter();
  const { token, contact, client, isLoggedIn } = usePortal();

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/portal/login");
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn || !contact || !client || !token) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-gray-400">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {contact.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Client portal dashboard</p>
        </div>
        <Badge variant="outline" className="self-start text-sm px-3 py-1">
          {client.name}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-4 w-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <HardDrive className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="submit" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Submit Ticket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <TicketsTab token={token} clientId={client.id} />
        </TabsContent>

        <TabsContent value="assets">
          <AssetsTab token={token} clientId={client.id} />
        </TabsContent>

        <TabsContent value="submit">
          <SubmitTab token={token} contact={contact} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tickets Tab
// ──────────────────────────────────────────────

function TicketsTab({ token, clientId }: { token: string; clientId: string }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (page: number, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clientId,
        page: page.toString(),
        limit: "20",
      });
      if (status !== "ALL") {
        params.set("status", status);
      }

      const res = await fetch(`/api/portal/tickets?${params.toString()}`, {
        headers: { "x-portal-token": token },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tickets");
      }

      const data = await res.json();
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    fetchTickets(1, statusFilter);
  }, [statusFilter, fetchTickets]);

  const formatStatusLabel = (status: string) => status.replace(/_/g, " ");

  const statuses = ["ALL", "OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"];

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Company Tickets</CardTitle>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All Statuses" : formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-gray-500 mt-2">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Ticket className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No tickets found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Subject</th>
                  <th className="pb-3 pr-4 font-medium hidden md:table-cell">Contact</th>
                  <th className="pb-3 pr-4 font-medium">Priority</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium hidden lg:table-cell">Assignee</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      // Navigate to status page - user can look up the ticket there
                      window.open(`/portal/status?number=${ticket.number}`, "_self");
                    }}
                  >
                    <td className="py-3 pr-4 font-mono text-gray-600">{ticket.number}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900 max-w-[200px] truncate">
                      {ticket.subject}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-gray-600">
                      {ticket.contact?.name || "-"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={cn(getPriorityColor(ticket.priority), "border-0 text-xs")}>
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={cn(getStatusColor(ticket.status), "border-0 text-xs")}>
                        {formatStatusLabel(ticket.status)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell text-gray-600">
                      {ticket.assignee?.name || "Unassigned"}
                    </td>
                    <td className="py-3 hidden sm:table-cell text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(ticket.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <CardFooter className="justify-between border-t pt-4">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tickets
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchTickets(pagination.page - 1, statusFilter)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchTickets(pagination.page + 1, statusFilter)}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────
// Assets Tab
// ──────────────────────────────────────────────

function AssetsTab({ token, clientId }: { token: string; clientId: string }) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/portal/assets?clientId=${clientId}`, {
          headers: { "x-portal-token": token },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch assets");
        }

        const data = await res.json();
        setAssets(data.assets);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [token, clientId]);

  const isWarrantyValid = (warrantyEnd: string | null): boolean | null => {
    if (!warrantyEnd) return null;
    return new Date(warrantyEnd) > new Date();
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Company Assets</CardTitle>
        <CardDescription>Hardware and software assets assigned to your organisation.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-gray-500 mt-2">Loading assets...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <HardDrive className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No assets found for your organisation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium hidden md:table-cell">Manufacturer</th>
                  <th className="pb-3 pr-4 font-medium hidden md:table-cell">Model</th>
                  <th className="pb-3 pr-4 font-medium hidden lg:table-cell">Hostname</th>
                  <th className="pb-3 font-medium">Warranty</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const warrantyValid = isWarrantyValid(asset.warrantyEnd);
                  return (
                    <tr key={asset.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-900">{asset.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{asset.type}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {asset.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-gray-600">
                        {asset.manufacturer || "-"}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-gray-600">
                        {asset.model || "-"}
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-gray-600 font-mono text-xs">
                        {asset.hostname || "-"}
                      </td>
                      <td className="py-3">
                        {warrantyValid === null ? (
                          <span className="text-gray-400 text-xs">N/A</span>
                        ) : warrantyValid ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                            Valid until {formatDate(asset.warrantyEnd!)}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                            Expired
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Submit Ticket Tab
// ──────────────────────────────────────────────

function SubmitTab({
  token,
  contact,
}: {
  token: string;
  contact: { id: string; name: string; email: string; isPrimary: boolean };
}) {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [onBehalfOf, setOnBehalfOf] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketSubmitResult | null>(null);

  // Fetch company contacts for "On behalf of" dropdown
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    // We use the token to check authentication; contacts come from the ticket list or a dedicated endpoint.
    // For simplicity, we only show the "on behalf of" field for primary contacts.
    // The actual name/email will be derived from the selected contact or self.
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitName = onBehalfOf || contact.name;
      const submitEmail = onBehalfOf
        ? contacts.find((c) => c.name === onBehalfOf)?.email || contact.email
        : contact.email;

      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal-token": token,
        },
        body: JSON.stringify({
          name: submitName,
          email: submitEmail,
          phone: phone.trim() || undefined,
          subject: subject.trim(),
          priority,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }

      setResult({
        number: data.number,
        subject: data.subject,
        message: data.message,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubject("");
    setPriority("MEDIUM");
    setDescription("");
    setPhone("");
    setOnBehalfOf("");
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <Card className="mt-4 border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-green-900">
                Ticket #{result.number} Created
              </CardTitle>
              <CardDescription className="text-green-700">
                {result.subject}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-800">
            Your ticket has been submitted. You&apos;ll receive updates via email.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={resetForm} variant="outline" className="gap-1.5">
            Submit Another Ticket
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Submit a Support Request</CardTitle>
        <CardDescription>
          Submit a ticket on behalf of yourself or another member of your organisation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Locked name and email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dash-name">Your Name</Label>
              <Input
                id="dash-name"
                value={contact.name}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-email">Email Address</Label>
              <Input
                id="dash-email"
                type="email"
                value={contact.email}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* On behalf of */}
          <div className="space-y-2">
            <Label htmlFor="onBehalf">On Behalf Of</Label>
            <Input
              id="onBehalf"
              value={onBehalfOf}
              onChange={(e) => setOnBehalfOf(e.target.value)}
              placeholder="Leave empty to submit as yourself, or enter a colleague's name"
            />
            <p className="text-xs text-gray-500">
              Optionally submit this ticket on behalf of another team member.
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="dash-phone">Phone Number</Label>
            <Input
              id="dash-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="dash-subject">Subject *</Label>
            <Input
              id="dash-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              required
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="dash-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="dash-description">Description *</Label>
            <Textarea
              id="dash-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Please describe your issue in detail..."
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Ticket
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
