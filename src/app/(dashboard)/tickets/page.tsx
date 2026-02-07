"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStatusColor,
  getPriorityColor,
  formatRelativeTime,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TicketClient {
  id: string;
  name: string;
}

interface TicketAssignee {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  client: TicketClient;
  assignee: TicketAssignee | null;
  createdAt: string;
  slaDeadline: string | null;
  slaBreached: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function getSLAIndicator(
  slaDeadline: string | null,
  slaBreached: boolean
): { color: string; title: string } {
  if (!slaDeadline) return { color: "bg-gray-300", title: "No SLA" };
  if (slaBreached) return { color: "bg-red-500", title: "SLA Breached" };

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / 3600000;

  if (diffHours <= 0) return { color: "bg-red-500", title: "SLA Breached" };
  if (diffHours <= 2) return { color: "bg-yellow-500", title: "SLA At Risk" };
  return { color: "bg-green-500", title: "SLA On Track" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter]);

  // Fetch tickets
  useEffect(() => {
    async function fetchTickets() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        params.set("page", String(page));
        params.set("limit", "20");

        const res = await fetch(`/api/tickets?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tickets");

        const data: TicketsResponse = await res.json();
        setTickets(data.tickets);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [page, statusFilter, priorityFilter, debouncedSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
        <Link href="/tickets/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="WAITING_ON_CLIENT">Waiting on Client</SelectItem>
            <SelectItem value="WAITING_ON_VENDOR">Waiting on Vendor</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>

        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {total} ticket{total !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-8 w-8" />
                      <p className="text-sm font-medium">No tickets found</p>
                      <p className="text-xs">
                        Try adjusting your filters or create a new ticket.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const sla = getSLAIndicator(
                    ticket.slaDeadline,
                    ticket.slaBreached
                  );
                  return (
                    <tr
                      key={ticket.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {ticket.number}
                      </td>
                      <td className="max-w-[300px] truncate px-4 py-3 font-medium">
                        {ticket.subject}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ticket.client.name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={getPriorityColor(ticket.priority)}
                          variant="secondary"
                        >
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={getStatusColor(ticket.status)}
                          variant="secondary"
                        >
                          {formatStatusLabel(ticket.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {ticket.assignee?.name || "Unassigned"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatRelativeTime(ticket.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${sla.color}`}
                          title={sla.title}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
