"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/lib/portal-context";

interface TicketItem {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  contact?: { name: string; email: string } | null;
  assignee?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  WAITING_ON_CLIENT: "bg-orange-100 text-orange-800",
  WAITING_ON_VENDOR: "bg-purple-100 text-purple-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function OrgTicketsPage() {
  const router = useRouter();
  const { isLoggedIn, contact, client, role } = usePortal();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    if (!isLoggedIn) router.push("/portal/login");
    else if (role !== "admin") router.push("/portal/dashboard");
  }, [isLoggedIn, role, router]);

  useEffect(() => {
    if (!isLoggedIn || !contact || !client || role !== "admin") return;
    async function fetchTickets() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          clientId: client!.id,
          page: page.toString(),
          limit: "20",
        });
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/portal/tickets?${params}`, {
          headers: { "x-portal-token": contact!.id },
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setTickets(data.tickets || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [isLoggedIn, contact, client, role, page, statusFilter]);

  if (!isLoggedIn || role !== "admin") return null;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organisation Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">All tickets for {client?.name}</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="WAITING_ON_CLIENT">Waiting on Client</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">Loading tickets...</CardContent></Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Building2 className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="font-semibold text-gray-700">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500">No tickets have been submitted for your organisation.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.number}</td>
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/portal/status?ticket=${t.number}&email=${contact?.email}`} className="text-primary hover:underline">
                            {t.subject}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{t.contact?.name || "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{t.assignee?.name || "Unassigned"}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
