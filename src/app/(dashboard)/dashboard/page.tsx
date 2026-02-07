"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Ticket, Clock, Shield, Timer, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getPriorityColor, formatRelativeTime } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusCount {
  status: string;
  count: number;
}

interface PriorityCount {
  priority: string;
  count: number;
}

interface RecentTicket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
  };
}

interface SLAAtRiskTicket {
  id: string;
  number: number;
  subject: string;
  priority: string;
  slaDeadline: string;
  slaBreached: boolean;
  client: {
    id: string;
    name: string;
  };
}

interface DashboardData {
  stats: {
    openTickets: number;
    inProgressTickets: number;
    slaCompliancePercent: number;
    avgResolutionTimeHours: number;
  };
  ticketsByStatus: StatusCount[];
  ticketsByPriority: PriorityCount[];
  recentTickets: RecentTicket[];
  slaAtRisk: SLAAtRiskTicket[];
}

// ---------------------------------------------------------------------------
// Chart colour maps
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#eab308",
  WAITING_ON_CLIENT: "#f97316",
  WAITING_ON_VENDOR: "#a855f7",
  RESOLVED: "#22c55e",
  CLOSED: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatTimeRemaining(deadline: string): string {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();

  if (diffMs <= 0) return "Breached";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays >= 1) return `${diffDays}d ${diffHours % 24}h left`;
  if (diffHours >= 1) return `${diffHours}h ${diffMins % 60}m left`;
  return `${diffMins}m left`;
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentClass: string;
}

function StatCard({ title, value, subtitle, icon, accentClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-md p-2 ${accentClass}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/dashboard");

        if (!res.ok) {
          throw new Error(`Failed to load dashboard data (${res.status})`);
        }

        const json: DashboardData = await res.json();
        setData(json);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Loading your service desk overview...
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TableSkeleton rows={6} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  // ---- Error state ----------------------------------------------------------
  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">
              {error || "Failed to load dashboard data"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Prepare chart data ---------------------------------------------------
  const statusChartData = data.ticketsByStatus.map((item) => ({
    name: formatStatusLabel(item.status),
    count: item.count,
    fill: STATUS_COLORS[item.status] || "#6b7280",
  }));

  const priorityChartData = data.ticketsByPriority.map((item) => ({
    name: item.priority.charAt(0) + item.priority.slice(1).toLowerCase(),
    value: item.count,
    fill: PRIORITY_COLORS[item.priority] || "#6b7280",
  }));

  const { stats } = data;

  const slaAccentClass =
    stats.slaCompliancePercent >= 90
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Service desk overview and key metrics
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stat cards                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Tickets"
          value={stats.openTickets}
          subtitle="Awaiting assignment or action"
          icon={<Ticket className="h-5 w-5" />}
          accentClass="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgressTickets}
          subtitle="Currently being worked on"
          icon={<Clock className="h-5 w-5" />}
          accentClass="bg-yellow-100 text-yellow-700"
        />
        <StatCard
          title="SLA Compliance"
          value={`${stats.slaCompliancePercent}%`}
          subtitle={
            stats.slaCompliancePercent >= 90
              ? "Within target"
              : "Below 90% target"
          }
          icon={<Shield className="h-5 w-5" />}
          accentClass={slaAccentClass}
        />
        <StatCard
          title="Avg Resolution Time"
          value={`${stats.avgResolutionTimeHours}h`}
          subtitle="Mean time to resolution"
          icon={<Timer className="h-5 w-5" />}
          accentClass="bg-purple-100 text-purple-700"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Charts                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tickets by Status - Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Tickets by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusChartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Priority - Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Tickets by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {priorityChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-sm text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Tickets & SLA At Risk                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Recent Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentTickets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tickets found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Subject</th>
                      <th className="pb-3 pr-4">Client</th>
                      <th className="pb-3 pr-4">Priority</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.recentTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="group transition-colors hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {ticket.number}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate py-3 pr-4 font-medium">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {ticket.subject}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {ticket.client.name}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            className={getPriorityColor(ticket.priority)}
                            variant="secondary"
                          >
                            {ticket.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            className={getStatusColor(ticket.status)}
                            variant="secondary"
                          >
                            {formatStatusLabel(ticket.status)}
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

        {/* SLA At Risk */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              SLA At Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.slaAtRisk.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Shield className="mb-2 h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  All tickets are within SLA targets.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.slaAtRisk.map((ticket) => {
                  const isBreached =
                    ticket.slaBreached || new Date(ticket.slaDeadline) <= new Date();
                  return (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className={`block rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                        isBreached
                          ? "border-red-200 bg-red-50"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium ${
                              isBreached ? "text-red-900" : "text-foreground"
                            }`}
                          >
                            {ticket.subject}
                          </p>
                          <p
                            className={`mt-0.5 text-xs ${
                              isBreached
                                ? "text-red-700"
                                : "text-muted-foreground"
                            }`}
                          >
                            {ticket.client.name}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge
                            className={getPriorityColor(ticket.priority)}
                            variant="secondary"
                          >
                            {ticket.priority}
                          </Badge>
                          <span
                            className={`whitespace-nowrap text-xs font-medium ${
                              isBreached
                                ? "text-red-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {isBreached ? (
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                SLA Breached
                              </span>
                            ) : (
                              formatTimeRemaining(ticket.slaDeadline)
                            )}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
