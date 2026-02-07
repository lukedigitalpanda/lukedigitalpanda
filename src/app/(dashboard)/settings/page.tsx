"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Shield,
  Users,
  Check,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface SLAMatrix {
  CRITICAL: { Gold: number; Silver: number; Bronze: number };
  HIGH: { Gold: number; Silver: number; Bronze: number };
  MEDIUM: { Gold: number; Silver: number; Bronze: number };
  LOW: { Gold: number; Silver: number; Bronze: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    MANAGER: "bg-blue-100 text-blue-800",
    TECHNICIAN: "bg-green-100 text-green-800",
    CLIENT_USER: "bg-gray-100 text-gray-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
}

const defaultSLA: SLAMatrix = {
  CRITICAL: { Gold: 1, Silver: 2, Bronze: 4 },
  HIGH: { Gold: 4, Silver: 8, Bronze: 16 },
  MEDIUM: { Gold: 8, Silver: 24, Bronze: 48 },
  LOW: { Gold: 24, Silver: 48, Bronze: 72 },
};

const PRIORITIES: (keyof SLAMatrix)[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SLA_LEVELS: ("Gold" | "Silver" | "Bronze")[] = [
  "Gold",
  "Silver",
  "Bronze",
];

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("email");

  // Email tab state
  const [emailConnected, setEmailConnected] = useState(false);
  const [mailbox, setMailbox] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [emailLoading, setEmailLoading] = useState(true);

  // SLA tab state
  const [slaMatrix, setSlaMatrix] = useState<SLAMatrix>(defaultSLA);
  const [slaSaved, setSlaSaved] = useState(false);

  // Users tab state
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // ---- Email integration ----
  useEffect(() => {
    async function fetchEmailStatus() {
      try {
        setEmailLoading(true);
        const res = await fetch("/api/email/status");
        if (res.ok) {
          const json = await res.json();
          setEmailConnected(json.connected ?? false);
          setMailbox(json.mailbox ?? null);
          setLastSync(json.lastSyncedAt ?? null);
        }
      } catch {
        // Email not configured - that's fine
      } finally {
        setEmailLoading(false);
      }
    }

    if (activeTab === "email") {
      fetchEmailStatus();
    }
  }, [activeTab]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setLastSync(json.syncedAt ?? new Date().toISOString());
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  }

  // ---- SLA ----
  function updateSLA(
    priority: keyof SLAMatrix,
    level: "Gold" | "Silver" | "Bronze",
    value: string
  ) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setSlaMatrix((prev) => ({
      ...prev,
      [priority]: { ...prev[priority], [level]: num },
    }));
    setSlaSaved(false);
  }

  function handleSaveSLA() {
    // Placeholder: stores in local state only for now
    setSlaSaved(true);
    setTimeout(() => setSlaSaved(false), 3000);
  }

  // ---- Users ----
  useEffect(() => {
    async function fetchUsers() {
      try {
        setUsersLoading(true);
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.data ?? [];
          setUsers(list);
        }
      } catch {
        // silently handle
      } finally {
        setUsersLoading(false);
      }
    }

    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage system configuration and integrations
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Integration
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Shield className="h-4 w-4" />
            SLA Configuration
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* Email Tab                                                       */}
        {/* ============================================================== */}
        <TabsContent value="email">
          {emailLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-6">
              {/* Connection status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-5 w-5" />
                    Microsoft 365 Email Integration
                  </CardTitle>
                  <CardDescription>
                    Sync emails from your shared mailbox to create and update
                    tickets automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status indicator */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        emailConnected
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {emailConnected ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <X className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {emailConnected ? "Connected" : "Not Connected"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {emailConnected
                          ? "Email sync is active and running."
                          : "Configure your Microsoft Graph credentials to enable email sync."}
                      </p>
                    </div>
                  </div>

                  {/* Mailbox */}
                  {mailbox && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase">
                        Mailbox
                      </Label>
                      <p className="font-mono text-sm">{mailbox}</p>
                    </div>
                  )}

                  {/* Last sync */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase">
                      Last Sync
                    </Label>
                    <p className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {lastSync ? formatDate(lastSync) : "Never synced"}
                    </p>
                  </div>

                  {/* Sync button */}
                  <Button onClick={handleSync} disabled={syncing}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {syncing ? "Syncing..." : "Sync Now"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* SLA Tab                                                         */}
        {/* ============================================================== */}
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5" />
                SLA Response Time Matrix
              </CardTitle>
              <CardDescription>
                Configure target response times (in hours) by priority and
                service level.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4 w-32">Priority</th>
                      {SLA_LEVELS.map((level) => (
                        <th key={level} className="pb-3 px-4 w-32">
                          {level}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {PRIORITIES.map((priority) => (
                      <tr key={priority}>
                        <td className="py-3 pr-4 font-medium">{priority}</td>
                        {SLA_LEVELS.map((level) => (
                          <td key={level} className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                value={slaMatrix[priority][level]}
                                onChange={(e) =>
                                  updateSLA(priority, level, e.target.value)
                                }
                                className="w-20 text-center"
                              />
                              <span className="text-xs text-muted-foreground">
                                hrs
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveSLA}>Save SLA Configuration</Button>
                {slaSaved && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    Saved successfully
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* Users Tab                                                       */}
        {/* ============================================================== */}
        <TabsContent value="users">
          {usersLoading ? (
            <SectionSkeleton />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    View and manage system users and their roles.
                  </CardDescription>
                </div>
                <Button variant="outline" disabled>
                  Invite User
                </Button>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="mb-4 h-10 w-10 text-muted-foreground" />
                    <p className="text-muted-foreground">No users found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          <th className="pb-3 pr-4">Name</th>
                          <th className="pb-3 pr-4">Email</th>
                          <th className="pb-3 pr-4">Role</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="py-3 pr-4 font-medium">
                              {user.name}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {user.email}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                className={getRoleColor(user.role)}
                                variant="secondary"
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="py-3">
                              {user.isActive ? (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <Check className="h-3 w-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <X className="h-3 w-3" />
                                  Inactive
                                </span>
                              )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
