"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Trash2,
  Building2,
  Ticket,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  metadata: string | null;
  userId: string;
  userName: string;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getActionIcon(entityType: string) {
  switch (entityType) {
    case "Ticket":
      return <Ticket className="h-4 w-4" />;
    case "Client":
      return <Building2 className="h-4 w-4" />;
    case "User":
      return <User className="h-4 w-4" />;
    default:
      return <ClipboardList className="h-4 w-4" />;
  }
}

function getActionColor(action: string): string {
  if (action.includes("deleted") || action.includes("deactivated")) {
    return "bg-red-100 text-red-800";
  }
  if (action.includes("created")) {
    return "bg-green-100 text-green-800";
  }
  if (action.includes("updated") || action.includes("changed")) {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-gray-100 text-gray-800";
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    async function fetchAuditLog() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "25",
        });
        if (entityFilter !== "all") {
          params.set("entityType", entityFilter);
        }
        const res = await fetch(`/api/audit-log?${params.toString()}`);
        if (res.ok) {
          const json: AuditResponse = await res.json();
          setData(json);
        }
      } catch {
        // Handle silently
      } finally {
        setLoading(false);
      }
    }
    fetchAuditLog();
  }, [page, entityFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track system changes including ticket and client deletions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Ticket">Tickets</SelectItem>
            <SelectItem value="Client">Clients</SelectItem>
            <SelectItem value="User">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            {data ? `${data.total} total entries` : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No audit log entries yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Actions like deleting tickets or removing clients will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {getActionIcon(entry.entityType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{entry.userName}</span>{" "}
                      {entry.details}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={getActionColor(entry.action)}
                      >
                        {formatAction(entry.action)}
                      </Badge>
                      <Badge variant="outline">{entry.entityType}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
