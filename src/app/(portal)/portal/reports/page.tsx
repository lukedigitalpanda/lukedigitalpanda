"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Shield,
  Wrench,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  Download,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/portal-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecSummary {
  ticketsCreated: number;
  ticketsResolved: number;
  currentOpenCount: number;
  avgResponseHours: number | null;
  avgResolutionHours: number | null;
  slaComplianceRate: number;
}

interface Distribution {
  category?: string;
  priority?: string;
  status?: string;
  source?: string;
  count: number;
  percentage: number;
}

interface TechnicalOperations {
  categoryDistribution: Distribution[];
  priorityDistribution: Distribution[];
  statusDistribution: Distribution[];
  sourceDistribution: Distribution[];
}

interface SLAMetric {
  total: number;
  met: number;
  missed: number;
  rate: number;
}

interface MissedTicket {
  number: number;
  subject: string;
  priority: string;
  status: string;
  slaDeadline: string | null;
  reason: string;
}

interface SLACompliance {
  totalWithSLA: number;
  compliant: number;
  breached: number;
  complianceRate: number;
  initialResponse: SLAMetric;
  resolution: SLAMetric;
  missedTickets: MissedTicket[];
}

interface ReportData {
  period: { from: string; to: string };
  execSummary: ExecSummary;
  technicalOperations: TechnicalOperations;
  slaCompliance: SLACompliance;
}

type ReportTab = "exec" | "technical" | "sla";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHours(hours: number | null): string {
  if (hours === null) return "N/A";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "CRITICAL": return "bg-red-100 text-red-800";
    case "HIGH": return "bg-orange-100 text-orange-800";
    case "MEDIUM": return "bg-yellow-100 text-yellow-800";
    case "LOW": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: string): string {
  return status.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// Simple horizontal bar
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  );
}

// Stat card used in exec summary
function StatCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
            {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
          </div>
          <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compliance gauge
function ComplianceGauge({ rate, label }: { rate: number; label: string }) {
  const color =
    rate >= 95 ? "text-green-600" : rate >= 80 ? "text-yellow-600" : "text-red-600";
  const bgColor =
    rate >= 95 ? "bg-green-100" : rate >= 80 ? "bg-yellow-100" : "bg-red-100";
  return (
    <div className="text-center">
      <div
        className={`inline-flex h-24 w-24 items-center justify-center rounded-full ${bgColor}`}
      >
        <span className={`text-2xl font-bold ${color}`}>{rate}%</span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-600">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalReportsPage() {
  const router = useRouter();
  const { isLoggedIn, token, client } = usePortal();

  const [activeTab, setActiveTab] = useState<ReportTab>("exec");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month navigation
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!isLoggedIn) router.push("/portal/login");
  }, [isLoggedIn, router]);

  const fetchReport = useCallback(async () => {
    if (!token || !client) return;
    try {
      setLoading(true);
      setError(null);
      const from = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const to = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const params = new URLSearchParams({
        clientId: client.id,
        from: from.toISOString(),
        to: to.toISOString(),
      });

      const res = await fetch(`/api/portal/reports?${params.toString()}`, {
        headers: { "x-portal-token": token },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to load report");
      }

      const json: ReportData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [token, client, selectedDate]);

  useEffect(() => {
    if (isLoggedIn) fetchReport();
  }, [isLoggedIn, fetchReport]);

  function prevMonth() {
    setSelectedDate(
      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    if (next <= new Date()) {
      setSelectedDate(next);
    }
  }

  const isCurrentMonth =
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getFullYear() === new Date().getFullYear();

  if (!isLoggedIn) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Link
        href="/portal/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
          <p className="text-sm text-gray-500">
            Service reports and performance analytics for {client?.name}
          </p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="px-4 py-1.5 text-sm font-medium text-gray-700 border rounded-md min-w-[180px] text-center">
          {getMonthLabel(selectedDate)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={nextMonth}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("exec")}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "exec"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <FileText className="h-4 w-4" />
          Executive Summary
        </button>
        <button
          onClick={() => setActiveTab("technical")}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "technical"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Wrench className="h-4 w-4" />
          Technical Operations
        </button>
        <button
          onClick={() => setActiveTab("sla")}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "sla"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Shield className="h-4 w-4" />
          SLA Compliance
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Generating report...</span>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="mb-3 h-8 w-8 text-red-400" />
            <p className="font-medium text-red-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchReport}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reports Content */}
      {!loading && !error && data && (
        <>
          {/* ============================================================== */}
          {/* EXECUTIVE SUMMARY                                               */}
          {/* ============================================================== */}
          {activeTab === "exec" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Executive Summary
                  </CardTitle>
                  <CardDescription>
                    High-level service desk performance for{" "}
                    {getMonthLabel(selectedDate)}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Tickets Created"
                  value={data.execSummary.ticketsCreated}
                  subtext={`In ${getMonthLabel(selectedDate)}`}
                  icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
                  color="bg-blue-100"
                />
                <StatCard
                  label="Tickets Resolved"
                  value={data.execSummary.ticketsResolved}
                  subtext={`In ${getMonthLabel(selectedDate)}`}
                  icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                  color="bg-green-100"
                />
                <StatCard
                  label="Currently Open"
                  value={data.execSummary.currentOpenCount}
                  subtext="Across all time"
                  icon={<Clock className="h-5 w-5 text-orange-600" />}
                  color="bg-orange-100"
                />
                <StatCard
                  label="Avg Response Time"
                  value={formatHours(data.execSummary.avgResponseHours)}
                  subtext="First response"
                  icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
                  color="bg-purple-100"
                />
                <StatCard
                  label="Avg Resolution Time"
                  value={formatHours(data.execSummary.avgResolutionHours)}
                  subtext="To resolved"
                  icon={<Clock className="h-5 w-5 text-indigo-600" />}
                  color="bg-indigo-100"
                />
                <StatCard
                  label="SLA Compliance"
                  value={`${data.execSummary.slaComplianceRate}%`}
                  subtext={
                    data.execSummary.slaComplianceRate >= 95
                      ? "On target"
                      : data.execSummary.slaComplianceRate >= 80
                      ? "Needs attention"
                      : "Below target"
                  }
                  icon={<Shield className="h-5 w-5 text-green-600" />}
                  color={
                    data.execSummary.slaComplianceRate >= 95
                      ? "bg-green-100"
                      : data.execSummary.slaComplianceRate >= 80
                      ? "bg-yellow-100"
                      : "bg-red-100"
                  }
                />
              </div>

              {/* Status breakdown */}
              {data.technicalOperations.statusDistribution.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      Ticket Status Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.technicalOperations.statusDistribution.map((s) => (
                        <div key={s.status} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {getStatusLabel(s.status!)}
                            </span>
                            <span className="font-medium text-gray-900">
                              {s.count} ({s.percentage}%)
                            </span>
                          </div>
                          <ProgressBar
                            value={s.count}
                            max={data.execSummary.ticketsCreated}
                            color="bg-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TECHNICAL OPERATIONS                                            */}
          {/* ============================================================== */}
          {activeTab === "technical" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wrench className="h-5 w-5 text-orange-600" />
                    Technical Operations Report
                  </CardTitle>
                  <CardDescription>
                    Ticket distribution and categorisation for{" "}
                    {getMonthLabel(selectedDate)}
                  </CardDescription>
                </CardHeader>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Category Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      By Category
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ticket volume by category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.technicalOperations.categoryDistribution.length ===
                    0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No tickets in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.technicalOperations.categoryDistribution.map(
                          (c) => (
                            <div key={c.category} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">
                                  {c.category}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {c.count} ({c.percentage}%)
                                </span>
                              </div>
                              <ProgressBar
                                value={c.count}
                                max={data.execSummary.ticketsCreated}
                                color="bg-orange-500"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      By Priority
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ticket volume by priority level
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.technicalOperations.priorityDistribution.length ===
                    0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No tickets in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.technicalOperations.priorityDistribution.map(
                          (p) => {
                            const barColor =
                              p.priority === "CRITICAL"
                                ? "bg-red-500"
                                : p.priority === "HIGH"
                                ? "bg-orange-500"
                                : p.priority === "MEDIUM"
                                ? "bg-yellow-500"
                                : "bg-green-500";
                            return (
                              <div key={p.priority} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={getPriorityColor(
                                        p.priority!
                                      )}
                                    >
                                      {p.priority}
                                    </Badge>
                                  </div>
                                  <span className="font-medium text-gray-900">
                                    {p.count} ({p.percentage}%)
                                  </span>
                                </div>
                                <ProgressBar
                                  value={p.count}
                                  max={data.execSummary.ticketsCreated}
                                  color={barColor}
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Source Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      By Source
                    </CardTitle>
                    <CardDescription className="text-xs">
                      How tickets were submitted
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.technicalOperations.sourceDistribution.length ===
                    0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No tickets in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.technicalOperations.sourceDistribution.map(
                          (s) => (
                            <div key={s.source} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">
                                  {s.source}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {s.count} ({s.percentage}%)
                                </span>
                              </div>
                              <ProgressBar
                                value={s.count}
                                max={data.execSummary.ticketsCreated}
                                color="bg-indigo-500"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      By Status
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Current ticket status breakdown
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.technicalOperations.statusDistribution.length ===
                    0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No tickets in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.technicalOperations.statusDistribution.map(
                          (s) => (
                            <div key={s.status} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">
                                  {getStatusLabel(s.status!)}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {s.count} ({s.percentage}%)
                                </span>
                              </div>
                              <ProgressBar
                                value={s.count}
                                max={data.execSummary.ticketsCreated}
                                color="bg-blue-500"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLA COMPLIANCE                                                  */}
          {/* ============================================================== */}
          {activeTab === "sla" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-green-600" />
                    SLA Compliance Report
                  </CardTitle>
                  <CardDescription>
                    Service Level Agreement performance for{" "}
                    {getMonthLabel(selectedDate)}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Compliance gauges */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Compliance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-around gap-6 py-4">
                    <ComplianceGauge
                      rate={data.slaCompliance.complianceRate}
                      label="Overall SLA"
                    />
                    <ComplianceGauge
                      rate={data.slaCompliance.initialResponse.rate}
                      label="Initial Response"
                    />
                    <ComplianceGauge
                      rate={data.slaCompliance.resolution.rate}
                      label="Resolution"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Detailed metrics */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-gray-500">
                      Initial Response SLA
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          Met
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.initialResponse.met}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Missed
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.initialResponse.missed}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="text-gray-600">Total Measured</span>
                        <span className="font-semibold">
                          {data.slaCompliance.initialResponse.total}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-gray-500">
                      Resolution SLA
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          Met
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.resolution.met}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Missed
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.resolution.missed}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="text-gray-600">Total Measured</span>
                        <span className="font-semibold">
                          {data.slaCompliance.resolution.total}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-gray-500">
                      Overall SLA Tickets
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          Compliant
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.compliant}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Breached
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.breached}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="text-gray-600">
                          Tickets with SLA
                        </span>
                        <span className="font-semibold">
                          {data.slaCompliance.totalWithSLA}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Missed SLA tickets detail */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Missed SLA Tickets
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tickets that breached or are at risk of breaching their SLA
                    target
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.slaCompliance.missedTickets.length === 0 ? (
                    <div className="flex flex-col items-center py-8">
                      <CheckCircle className="mb-2 h-8 w-8 text-green-400" />
                      <p className="text-sm font-medium text-green-600">
                        No SLA breaches this period
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            <th className="pb-3 pr-4">Ticket</th>
                            <th className="pb-3 pr-4">Priority</th>
                            <th className="pb-3 pr-4">Status</th>
                            <th className="pb-3 pr-4">SLA Deadline</th>
                            <th className="pb-3">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.slaCompliance.missedTickets.map((t) => (
                            <tr key={t.number}>
                              <td className="py-3 pr-4">
                                <p className="font-medium text-gray-900">
                                  #{t.number}
                                </p>
                                <p className="truncate text-xs text-gray-500 max-w-[200px]">
                                  {t.subject}
                                </p>
                              </td>
                              <td className="py-3 pr-4">
                                <Badge
                                  variant="secondary"
                                  className={getPriorityColor(t.priority)}
                                >
                                  {t.priority}
                                </Badge>
                              </td>
                              <td className="py-3 pr-4 text-gray-600">
                                {getStatusLabel(t.status)}
                              </td>
                              <td className="py-3 pr-4 text-xs text-gray-500">
                                {t.slaDeadline
                                  ? new Date(t.slaDeadline).toLocaleDateString(
                                      "en-GB",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "-"}
                              </td>
                              <td className="py-3 text-xs text-red-600">
                                {t.reason}
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
          )}
        </>
      )}
    </div>
  );
}
