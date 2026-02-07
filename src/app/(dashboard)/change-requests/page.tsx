"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  formatDate,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangeRequest {
  id: string;
  number: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  risk: string;
  scheduledStart: string | null;
  createdAt: string;
  client: { id: string; name: string };
  createdBy: { id: string; name: string };
}

interface PaginatedResponse {
  data: ChangeRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    STANDARD: "bg-blue-100 text-blue-800",
    NORMAL: "bg-yellow-100 text-yellow-800",
    EMERGENCY: "bg-red-100 text-red-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

function getRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
  };
  return colors[risk] || "bg-gray-100 text-gray-800";
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="space-y-0 divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const STATUSES = [
  "ALL",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const TYPES = ["ALL", "STANDARD", "NORMAL", "EMERGENCY"];

export default function ChangeRequestsPage() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (typeFilter !== "ALL") params.set("type", typeFilter);

        const res = await fetch(`/api/change-requests?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);

        const json: PaginatedResponse = await res.json();
        setData(json);
      } catch (err) {
        console.error("Change requests fetch error:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [page, statusFilter, typeFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change Requests</h1>
          <p className="text-muted-foreground">
            Manage change requests and approvals
          </p>
        </div>
        <Link href="/change-requests/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Change Request
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All Statuses" : formatStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "ALL"
                  ? "All Types"
                  : t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitPullRequest className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && <TableSkeleton />}

      {/* Table */}
      {!loading && !error && data && (
        <Card>
          <CardContent className="p-0">
            {data.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <GitPullRequest className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium text-muted-foreground">
                  No change requests found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a new change request to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3">#</th>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Priority</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Risk</th>
                      <th className="px-6 py-3">Scheduled</th>
                      <th className="px-6 py-3">Creator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.data.map((cr) => (
                      <tr
                        key={cr.id}
                        className="group transition-colors hover:bg-muted/50"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          <Link
                            href={`/change-requests/${cr.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            CR-{cr.number}
                          </Link>
                        </td>
                        <td className="max-w-[250px] truncate px-6 py-4 font-medium">
                          <Link
                            href={`/change-requests/${cr.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {cr.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={getTypeColor(cr.type)} variant="secondary">
                            {cr.type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {cr.client.name}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            className={getPriorityColor(cr.priority)}
                            variant="secondary"
                          >
                            {cr.priority}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            className={getStatusColor(cr.status)}
                            variant="secondary"
                          >
                            {formatStatusLabel(cr.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            className={getRiskColor(cr.risk)}
                            variant="secondary"
                          >
                            {cr.risk}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-xs text-muted-foreground">
                          {cr.scheduledStart
                            ? formatDate(cr.scheduledStart)
                            : "Not scheduled"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {cr.createdBy.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, data.total)} of {data.total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === data.totalPages ||
                  Math.abs(p - page) <= 1
              )
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                typeof item === "string" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
