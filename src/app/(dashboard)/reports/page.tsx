"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getPriorityColor, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
  "#f97316",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SLAReport {
  compliancePercent: number;
  complianceByPriority: { priority: string; compliance: number; total: number }[];
  breachedTickets: {
    id: string;
    number: number;
    subject: string;
    priority: string;
    client: string;
    slaDeadline: string;
  }[];
}

interface TechnicianReport {
  technicians: {
    id: string;
    name: string;
    assigned: number;
    resolved: number;
    avgResolutionHours: number;
    totalHours: number;
  }[];
}

interface ClientReport {
  clients: {
    id: string;
    name: string;
    totalTickets: number;
    openTickets: number;
    slaCompliance: number;
  }[];
}

interface VolumeReport {
  ticketsOverTime: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
  summary: {
    totalCreated: number;
    totalResolved: number;
    totalOpen: number;
    avgResolutionHours: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

function TabSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="h-[300px] w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [activeTab, setActiveTab] = useState("sla");

  // Data per tab
  const [slaData, setSlaData] = useState<SLAReport | null>(null);
  const [techData, setTechData] = useState<TechnicianReport | null>(null);
  const [clientData, setClientData] = useState<ClientReport | null>(null);
  const [volumeData, setVolumeData] = useState<VolumeReport | null>(null);

  // Loading per tab
  const [slaLoading, setSlaLoading] = useState(false);
  const [techLoading, setTechLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [volumeLoading, setVolumeLoading] = useState(false);

  const fetchReport = useCallback(
    async (type: string) => {
      const params = new URLSearchParams({
        type,
        from: fromDate,
        to: toDate,
      });

      try {
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch ${type} report`);
        return await res.json();
      } catch (err) {
        console.error(`Report fetch error (${type}):`, err);
        return null;
      }
    },
    [fromDate, toDate]
  );

  const loadTab = useCallback(
    async (tab: string) => {
      switch (tab) {
        case "sla":
          setSlaLoading(true);
          setSlaData(await fetchReport("sla"));
          setSlaLoading(false);
          break;
        case "technician":
          setTechLoading(true);
          setTechData(await fetchReport("technician"));
          setTechLoading(false);
          break;
        case "client":
          setClientLoading(true);
          setClientData(await fetchReport("client"));
          setClientLoading(false);
          break;
        case "volume":
          setVolumeLoading(true);
          setVolumeData(await fetchReport("volume"));
          setVolumeLoading(false);
          break;
      }
    },
    [fetchReport]
  );

  // Load active tab on mount
  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  function handleGenerate() {
    // Clear cached data so all tabs refetch
    setSlaData(null);
    setTechData(null);
    setClientData(null);
    setVolumeData(null);
    loadTab(activeTab);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Analytics and performance metrics
        </p>
      </div>

      {/* Date range */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label htmlFor="fromDate" className="text-xs">
              From
            </Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="toDate" className="text-xs">
              To
            </Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <Button onClick={handleGenerate}>Generate</Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sla">SLA Performance</TabsTrigger>
          <TabsTrigger value="technician">Technician Metrics</TabsTrigger>
          <TabsTrigger value="client">Client Summary</TabsTrigger>
          <TabsTrigger value="volume">Ticket Volume</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------------- */}
        {/* SLA Tab                                                         */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="sla">
          {slaLoading ? (
            <TabSkeleton />
          ) : slaData ? (
            <div className="space-y-6">
              {/* Big number */}
              <Card>
                <CardContent className="flex items-center gap-6 p-6">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ${
                      slaData.compliancePercent >= 90
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {slaData.compliancePercent}%
                  </div>
                  <div>
                    <p className="text-lg font-semibold">SLA Compliance</p>
                    <p className="text-sm text-muted-foreground">
                      {slaData.compliancePercent >= 90
                        ? "Within target"
                        : "Below 90% target"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance by priority bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    SLA Compliance by Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slaData.complianceByPriority}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, "Compliance"]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Bar dataKey="compliance" radius={[4, 4, 0, 0]}>
                          {slaData.complianceByPriority.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Breached tickets table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Breached Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  {slaData.breachedTickets.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No SLA breaches in this period.
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
                            <th className="pb-3">SLA Deadline</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {slaData.breachedTickets.map((ticket) => (
                            <tr key={ticket.id}>
                              <td className="py-3 pr-4 font-mono text-xs">
                                {ticket.number}
                              </td>
                              <td className="max-w-[200px] truncate py-3 pr-4">
                                {ticket.subject}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {ticket.client}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge
                                  className={getPriorityColor(ticket.priority)}
                                  variant="secondary"
                                >
                                  {ticket.priority}
                                </Badge>
                              </td>
                              <td className="py-3 text-xs text-muted-foreground">
                                {formatDate(ticket.slaDeadline)}
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
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No SLA data available. Click Generate to load the report.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* -------------------------------------------------------------- */}
        {/* Technician Tab                                                  */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="technician">
          {techLoading ? (
            <TabSkeleton />
          ) : techData ? (
            <div className="space-y-6">
              {/* Bar chart: resolved per tech */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Tickets Resolved per Technician
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={techData.technicians}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Bar
                          dataKey="resolved"
                          fill={CHART_COLORS[0]}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Technician table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Technician Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <th className="pb-3 pr-4">Name</th>
                          <th className="pb-3 pr-4">Assigned</th>
                          <th className="pb-3 pr-4">Resolved</th>
                          <th className="pb-3 pr-4">Avg Resolution</th>
                          <th className="pb-3">Hours Logged</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {techData.technicians.map((tech) => (
                          <tr key={tech.id}>
                            <td className="py-3 pr-4 font-medium">
                              {tech.name}
                            </td>
                            <td className="py-3 pr-4">{tech.assigned}</td>
                            <td className="py-3 pr-4">{tech.resolved}</td>
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {tech.avgResolutionHours}h
                              </span>
                            </td>
                            <td className="py-3">{tech.totalHours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No technician data available. Click Generate to load.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* -------------------------------------------------------------- */}
        {/* Client Tab                                                      */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="client">
          {clientLoading ? (
            <TabSkeleton />
          ) : clientData ? (
            <div className="space-y-6">
              {/* Pie chart: tickets by client */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Ticket Distribution by Client
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={clientData.clients.map((c) => ({
                            name: c.name,
                            value: c.totalTickets,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {clientData.clients.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Client table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Client Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <th className="pb-3 pr-4">Client</th>
                          <th className="pb-3 pr-4">Total Tickets</th>
                          <th className="pb-3 pr-4">Open</th>
                          <th className="pb-3">SLA Compliance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {clientData.clients.map((client) => (
                          <tr key={client.id}>
                            <td className="py-3 pr-4 font-medium">
                              {client.name}
                            </td>
                            <td className="py-3 pr-4">{client.totalTickets}</td>
                            <td className="py-3 pr-4">{client.openTickets}</td>
                            <td className="py-3">
                              <span
                                className={`font-medium ${
                                  client.slaCompliance >= 90
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {client.slaCompliance}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No client data available. Click Generate to load.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* -------------------------------------------------------------- */}
        {/* Volume Tab                                                      */}
        {/* -------------------------------------------------------------- */}
        <TabsContent value="volume">
          {volumeLoading ? (
            <TabSkeleton />
          ) : volumeData ? (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Total Created
                    </p>
                    <p className="text-2xl font-bold">
                      {volumeData.summary.totalCreated}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Total Resolved
                    </p>
                    <p className="text-2xl font-bold">
                      {volumeData.summary.totalResolved}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Currently Open
                    </p>
                    <p className="text-2xl font-bold">
                      {volumeData.summary.totalOpen}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Avg Resolution
                    </p>
                    <p className="text-2xl font-bold">
                      {volumeData.summary.avgResolutionHours}h
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Line chart: tickets over time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Ticket Volume Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={volumeData.ticketsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke={CHART_COLORS[0]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Bar chart: by category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Tickets by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeData.byCategory}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {volumeData.byCategory.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No volume data available. Click Generate to load.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
