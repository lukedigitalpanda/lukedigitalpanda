"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Shield,
  Users,
  Tags,
  Check,
  X,
  Clock,
  Sparkles,
  Plus,
  Building2,
  Upload,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle?: string;
  isActive: boolean;
  clientId?: string;
  client?: {
    id: string;
    name: string;
  };
}

interface ClientEntry {
  id: string;
  name: string;
  logoUrl?: string | null;
}

interface SLAMatrix {
  CRITICAL: { Gold: number; Silver: number; Bronze: number };
  HIGH: { Gold: number; Silver: number; Bronze: number };
  MEDIUM: { Gold: number; Silver: number; Bronze: number };
  LOW: { Gold: number; Silver: number; Bronze: number };
}

interface CategorySettings {
  ticketCategories: string[];
  knowledgeCategories: string[];
  assetTypes: string[];
  changeTypes: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    MANAGER: "bg-blue-100 text-blue-800",
    TECHNICIAN: "bg-green-100 text-green-800",
    CLIENT_USER: "bg-orange-100 text-orange-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    TECHNICIAN: "Technician",
    CLIENT_USER: "Client Portal User",
  };
  return labels[role] || role;
}

const defaultSLA: SLAMatrix = {
  CRITICAL: { Gold: 1, Silver: 2, Bronze: 4 },
  HIGH: { Gold: 4, Silver: 8, Bronze: 16 },
  MEDIUM: { Gold: 8, Silver: 24, Bronze: 48 },
  LOW: { Gold: 24, Silver: 48, Bronze: 72 },
};

const PRIORITIES: (keyof SLAMatrix)[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SLA_LEVELS: ("Gold" | "Silver" | "Bronze")[] = ["Gold", "Silver", "Bronze"];

// ---------------------------------------------------------------------------
// Loading skeleton
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
// Editable Category List component
// ---------------------------------------------------------------------------

function CategoryList({
  title,
  description,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
}) {
  const [newItem, setNewItem] = useState("");

  function handleAdd() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setNewItem("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="gap-1.5 pl-3 pr-1.5 py-1.5"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add new..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("categories");

  // ---- Categories tab state ----
  const [categories, setCategories] = useState<CategorySettings | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [categoriesSaved, setCategoriesSaved] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // ---- Email tab state ----
  const [emailConnected, setEmailConnected] = useState(false);
  const [mailbox, setMailbox] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [emailLoading, setEmailLoading] = useState(true);

  // ---- SLA tab state ----
  const [slaMatrix, setSlaMatrix] = useState<SLAMatrix>(defaultSLA);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaSaving, setSlaSaving] = useState(false);
  const [slaSaved, setSlaSaved] = useState(false);
  const [slaError, setSlaError] = useState<string | null>(null);

  // ---- Email form state ----
  const [emailForm, setEmailForm] = useState({ clientId: "", clientSecret: "", tenantId: "", mailbox: "" });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaveResult, setEmailSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [emailFromEnv, setEmailFromEnv] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // ---- Users tab state ----
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "TECHNICIAN",
    jobTitle: "",
    clientId: "",
  });
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // ---- Fetch categories ----
  useEffect(() => {
    async function fetchCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch("/api/settings/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch {
        // Use defaults
      } finally {
        setCategoriesLoading(false);
      }
    }
    if (activeTab === "categories") fetchCategories();
  }, [activeTab]);

  async function saveCategories() {
    if (!categories) return;
    try {
      setCategoriesSaving(true);
      setCategoriesError(null);
      const res = await fetch("/api/settings/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categories),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        setCategoriesSaved(true);
        setTimeout(() => setCategoriesSaved(false), 3000);
      } else {
        const errData = await res.json().catch(() => null);
        setCategoriesError(errData?.error || `Save failed (${res.status})`);
      }
    } catch (err) {
      console.error("Save categories error:", err);
      setCategoriesError("Network error - failed to save categories");
    } finally {
      setCategoriesSaving(false);
    }
  }

  function updateCategoryList(key: keyof CategorySettings, items: string[]) {
    if (!categories) return;
    setCategories({ ...categories, [key]: items });
    setCategoriesSaved(false);
  }

  // ---- Email integration ----
  useEffect(() => {
    async function fetchEmailStatus() {
      try {
        setEmailLoading(true);
        const [statusRes, configRes] = await Promise.all([
          fetch("/api/email/status"),
          fetch("/api/settings/email"),
        ]);
        if (statusRes.ok) {
          const json = await statusRes.json();
          setEmailConnected(json.connected ?? false);
          setMailbox(json.mailbox ?? null);
          setLastSync(json.lastSyncedAt ?? null);
        }
        if (configRes.ok) {
          const cfg = await configRes.json();
          setEmailFromEnv(cfg.fromEnv ?? false);
          setEmailForm({
            clientId: cfg.clientId || "",
            clientSecret: "",   // never pre-fill secret
            tenantId: cfg.tenantId || "",
            mailbox: cfg.mailbox || "",
          });
        }
      } catch {
        // Email not configured
      } finally {
        setEmailLoading(false);
      }
    }
    if (activeTab === "email") fetchEmailStatus();
  }, [activeTab]);

  async function handleSaveEmailConfig(e: React.FormEvent) {
    e.preventDefault();
    try {
      setEmailSaving(true);
      setEmailSaveResult(null);
      const res = await fetch("/api/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });
      if (res.ok) {
        setEmailSaveResult({ ok: true, msg: "Credentials saved. Testing connection..." });
        // Re-fetch status to show connected state
        const statusRes = await fetch("/api/email/status");
        if (statusRes.ok) {
          const json = await statusRes.json();
          setEmailConnected(json.connected ?? false);
          setMailbox(json.mailbox ?? null);
        }
        setEmailSaveResult({ ok: true, msg: "Credentials saved successfully." });
      } else {
        const err = await res.json().catch(() => null);
        setEmailSaveResult({ ok: false, msg: err?.error || `Save failed (${res.status})` });
      }
    } catch {
      setEmailSaveResult({ ok: false, msg: "Network error – failed to save." });
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncResult({ ok: true, ...json.data });
        setLastSync(new Date().toISOString());
      } else {
        setSyncResult({ ok: false, error: json.error || "Sync failed" });
      }
    } catch (err) {
      setSyncResult({ ok: false, error: "Network error" });
    } finally {
      setSyncing(false);
    }
  }

  // ---- SLA ----
  useEffect(() => {
    async function fetchSLA() {
      try {
        setSlaLoading(true);
        const res = await fetch("/api/settings/sla");
        if (res.ok) {
          const data = await res.json();
          setSlaMatrix(data);
        }
      } catch { /* use defaults */ } finally {
        setSlaLoading(false);
      }
    }
    if (activeTab === "sla") fetchSLA();
  }, [activeTab]);

  function updateSLA(priority: keyof SLAMatrix, level: "Gold" | "Silver" | "Bronze", value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setSlaMatrix((prev) => ({ ...prev, [priority]: { ...prev[priority], [level]: num } }));
    setSlaSaved(false);
  }

  async function handleSaveSLA() {
    try {
      setSlaSaving(true);
      setSlaError(null);
      const res = await fetch("/api/settings/sla", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slaMatrix),
      });
      if (res.ok) {
        setSlaSaved(true);
        setTimeout(() => setSlaSaved(false), 3000);
      } else {
        const err = await res.json().catch(() => null);
        setSlaError(err?.error || `Save failed (${res.status})`);
      }
    } catch {
      setSlaError("Network error – failed to save SLA matrix");
    } finally {
      setSlaSaving(false);
    }
  }

  // ---- Users ----
  useEffect(() => {
    async function fetchUsers() {
      try {
        setUsersLoading(true);
        const [usersRes, clientsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/clients?limit=100"),
        ]);
        if (usersRes.ok) {
          const json = await usersRes.json();
          const list = Array.isArray(json) ? json : json.data ?? [];
          setUsers(list);
        }
        if (clientsRes.ok) {
          const json = await clientsRes.json();
          const clientList = json.clients || (Array.isArray(json) ? json : []);
          setClients(clientList);
        }
      } catch {
        // silently handle
      } finally {
        setUsersLoading(false);
      }
    }
    if (activeTab === "users") fetchUsers();
  }, [activeTab]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateUserError(null);
    if (!newUser.name || !newUser.email || !newUser.password) {
      setCreateUserError("Name, email, and password are required.");
      return;
    }
    if (newUser.role === "CLIENT_USER" && !newUser.clientId) {
      setCreateUserError("Please select a client company for this portal user.");
      return;
    }
    try {
      setCreatingUser(true);
      const payload: any = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        jobTitle: newUser.jobTitle || undefined,
      };
      if (newUser.role === "CLIENT_USER" && newUser.clientId) {
        payload.clientId = newUser.clientId;
      }
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create user");
      }
      const user = await res.json();
      setUsers((prev) => [...prev, user]);
      setShowCreateUser(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "TECHNICIAN",
        jobTitle: "",
        clientId: "",
      });
    } catch (err) {
      setCreateUserError(
        err instanceof Error ? err.message : "Failed to create user"
      );
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage system configuration, categories, and integrations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="categories" className="gap-2">
            <Tags className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Shield className="h-4 w-4" />
            SLA Configuration
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Integration
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Categories Tab                                                    */}
        {/* ================================================================ */}
        <TabsContent value="categories">
          {categoriesLoading || !categories ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-6">
              <CategoryList
                title="Ticket Categories"
                description="Categories available when creating or classifying support tickets."
                items={categories.ticketCategories}
                onAdd={(item) =>
                  updateCategoryList("ticketCategories", [
                    ...categories.ticketCategories,
                    item,
                  ])
                }
                onRemove={(idx) =>
                  updateCategoryList(
                    "ticketCategories",
                    categories.ticketCategories.filter((_, i) => i !== idx)
                  )
                }
              />

              <CategoryList
                title="Knowledge Base Categories"
                description="Categories for organizing knowledge base articles."
                items={categories.knowledgeCategories}
                onAdd={(item) =>
                  updateCategoryList("knowledgeCategories", [
                    ...categories.knowledgeCategories,
                    item,
                  ])
                }
                onRemove={(idx) =>
                  updateCategoryList(
                    "knowledgeCategories",
                    categories.knowledgeCategories.filter((_, i) => i !== idx)
                  )
                }
              />

              <CategoryList
                title="Asset Types"
                description="Types of assets that can be tracked in the system."
                items={categories.assetTypes}
                onAdd={(item) =>
                  updateCategoryList("assetTypes", [
                    ...categories.assetTypes,
                    item,
                  ])
                }
                onRemove={(idx) =>
                  updateCategoryList(
                    "assetTypes",
                    categories.assetTypes.filter((_, i) => i !== idx)
                  )
                }
              />

              <CategoryList
                title="Change Request Types"
                description="Types of change requests available in the system."
                items={categories.changeTypes}
                onAdd={(item) =>
                  updateCategoryList("changeTypes", [
                    ...categories.changeTypes,
                    item,
                  ])
                }
                onRemove={(idx) =>
                  updateCategoryList(
                    "changeTypes",
                    categories.changeTypes.filter((_, i) => i !== idx)
                  )
                }
              />

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Button onClick={saveCategories} disabled={categoriesSaving}>
                    {categoriesSaving ? "Saving..." : "Save All Categories"}
                  </Button>
                  {categoriesSaved && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Saved successfully
                    </span>
                  )}
                </div>
                {categoriesError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {categoriesError}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* SLA Tab                                                           */}
        {/* ================================================================ */}
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

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveSLA} disabled={slaSaving}>
                    {slaSaving ? "Saving..." : "Save SLA Configuration"}
                  </Button>
                  {slaSaved && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Saved – new tickets will use updated SLA targets
                    </span>
                  )}
                </div>
                {slaError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {slaError}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Changes apply to new tickets only. Existing tickets keep their original SLA deadline.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Users Tab                                                         */}
        {/* ================================================================ */}
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
                <Button
                  variant="outline"
                  onClick={() => setShowCreateUser(!showCreateUser)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create user form */}
                {showCreateUser && (
                  <Card className="border-primary/20 bg-muted/30">
                    <CardContent className="pt-6">
                      <form onSubmit={handleCreateUser} className="space-y-4">
                        {createUserError && (
                          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {createUserError}
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              placeholder="Full name"
                              value={newUser.name}
                              onChange={(e) =>
                                setNewUser({ ...newUser, name: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              placeholder="user@company.com"
                              value={newUser.email}
                              onChange={(e) =>
                                setNewUser({ ...newUser, email: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                              type="password"
                              placeholder="Set a password"
                              value={newUser.password}
                              onChange={(e) =>
                                setNewUser({
                                  ...newUser,
                                  password: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select
                              value={newUser.role}
                              onValueChange={(val) =>
                                setNewUser({ ...newUser, role: val, clientId: "" })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MANAGER">Manager</SelectItem>
                                <SelectItem value="TECHNICIAN">
                                  Technician
                                </SelectItem>
                                <SelectItem value="CLIENT_USER">
                                  Client Portal User
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Client selector - shown only for CLIENT_USER role */}
                          {newUser.role === "CLIENT_USER" && (
                            <div className="space-y-2">
                              <Label>
                                Client Company
                                <span className="text-red-500 ml-1">*</span>
                              </Label>
                              <Select
                                value={newUser.clientId}
                                onValueChange={(val) =>
                                  setNewUser({ ...newUser, clientId: val })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a client..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {clients.map((client) => (
                                    <SelectItem key={client.id} value={client.id}>
                                      <span className="flex items-center gap-2">
                                        <Building2 className="h-3 w-3 text-muted-foreground" />
                                        {client.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                This user will be able to log in to the self-service portal and see tickets for this company.
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Job Title (optional)</Label>
                            <Input
                              placeholder="e.g. IT Director"
                              value={newUser.jobTitle}
                              onChange={(e) =>
                                setNewUser({
                                  ...newUser,
                                  jobTitle: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={creatingUser}
                          >
                            {creatingUser ? "Creating..." : "Create User"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCreateUser(false);
                              setCreateUserError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Users table */}
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
                          <th className="pb-3 pr-4">Company</th>
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
                                {getRoleLabel(user.role)}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {user.client ? (
                                <span className="flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3" />
                                  {user.client.name}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
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

        {/* ================================================================ */}
        {/* Email Tab                                                         */}
        {/* ================================================================ */}
        <TabsContent value="email">
          {emailLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-6">

              {/* Status card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-5 w-5" />
                    Microsoft 365 Email Sync
                  </CardTitle>
                  <CardDescription>
                    Automatically convert incoming emails to tickets and thread replies back to existing tickets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${emailConnected ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                      {emailConnected ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{emailConnected ? "Connected" : "Not configured"}</p>
                      <p className="text-sm text-muted-foreground">
                        {emailConnected
                          ? `Syncing mailbox: ${mailbox}`
                          : emailFromEnv
                          ? "Credentials set via environment variables"
                          : "Enter your Azure App credentials below to enable email sync"}
                      </p>
                    </div>
                  </div>

                  {emailConnected && (
                    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Last Sync</p>
                        <p className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5" />
                          {lastSync ? formatDate(lastSync) : "Never synced"}
                        </p>
                      </div>
                      <Button onClick={handleSync} disabled={syncing} size="sm">
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing..." : "Sync Now"}
                      </Button>
                    </div>
                  )}

                  {/* Sync result */}
                  {syncResult && (
                    <div className={`rounded-lg border p-4 text-sm ${syncResult.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      {syncResult.ok ? (
                        <div className="space-y-1">
                          <p className="font-medium text-green-800">Sync completed</p>
                          <div className="grid grid-cols-2 gap-x-4 text-green-700 sm:grid-cols-4">
                            <span>Emails fetched: <strong>{syncResult.emailsFetched}</strong></span>
                            <span>Tickets created: <strong>{syncResult.ticketsCreated}</strong></span>
                            <span>Comments added: <strong>{syncResult.commentsAdded}</strong></span>
                            <span>Duplicates skipped: <strong>{syncResult.duplicatesSkipped}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-red-700">{syncResult.error}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Setup Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Azure App Registration Setup</CardTitle>
                  <CardDescription className="text-xs">
                    Follow these steps to connect your Microsoft 365 mailbox. You only need to do this once.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4 text-sm">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span>
                      <div>
                        <p className="font-medium">Create an App Registration in Azure</p>
                        <p className="mt-0.5 text-muted-foreground">Go to <strong>portal.azure.com</strong> → Azure Active Directory → App registrations → New registration. Give it a name like "Digital Panda Service Desk".</p>
                        <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline">
                          Open Azure Portal <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
                      <div>
                        <p className="font-medium">Copy the Application (client) ID and Directory (tenant) ID</p>
                        <p className="mt-0.5 text-muted-foreground">These are on the app's Overview page. You'll need both below.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">3</span>
                      <div>
                        <p className="font-medium">Create a Client Secret</p>
                        <p className="mt-0.5 text-muted-foreground">Certificates &amp; secrets → New client secret. Copy the <strong>Value</strong> immediately – it won't be shown again.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">4</span>
                      <div>
                        <p className="font-medium">Add API Permissions</p>
                        <p className="mt-0.5 text-muted-foreground">API Permissions → Add a permission → Microsoft Graph → Application permissions. Add: <code className="rounded bg-muted px-1">Mail.Read</code>, <code className="rounded bg-muted px-1">Mail.ReadWrite</code>, <code className="rounded bg-muted px-1">Mail.Send</code>, <code className="rounded bg-muted px-1">MailboxSettings.Read</code>. Then click <strong>Grant admin consent</strong>.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">5</span>
                      <div>
                        <p className="font-medium">Enter credentials below</p>
                        <p className="mt-0.5 text-muted-foreground">Fill in the form and save. The mailbox should be the shared support email address (e.g. support@yourcompany.com).</p>
                      </div>
                    </li>
                  </ol>
                </CardContent>
              </Card>

              {/* Credentials form */}
              {emailFromEnv ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-900">Credentials configured via environment variables</p>
                        <p className="mt-1 text-sm text-amber-700">
                          MS_GRAPH_* environment variables are set on your server. Those take priority over the form below. To manage credentials here instead, remove the environment variables and save your credentials in the form.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Azure App Credentials</CardTitle>
                    <CardDescription className="text-xs">
                      Credentials are encrypted and stored securely in the database.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="em-tenantId">Directory (Tenant) ID</Label>
                          <Input
                            id="em-tenantId"
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={emailForm.tenantId}
                            onChange={(e) => setEmailForm({ ...emailForm, tenantId: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="em-clientId">Application (Client) ID</Label>
                          <Input
                            id="em-clientId"
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={emailForm.clientId}
                            onChange={(e) => setEmailForm({ ...emailForm, clientId: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="em-secret">Client Secret</Label>
                          <div className="relative">
                            <Input
                              id="em-secret"
                              type={showSecret ? "text" : "password"}
                              placeholder={emailConnected ? "••••••••  (leave blank to keep current)" : "Enter client secret value"}
                              value={emailForm.clientSecret}
                              onChange={(e) => setEmailForm({ ...emailForm, clientSecret: e.target.value })}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecret(!showSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="em-mailbox">Shared Mailbox Address</Label>
                          <Input
                            id="em-mailbox"
                            type="email"
                            placeholder="support@yourcompany.com"
                            value={emailForm.mailbox}
                            onChange={(e) => setEmailForm({ ...emailForm, mailbox: e.target.value })}
                          />
                        </div>
                      </div>

                      {emailSaveResult && (
                        <div className={`rounded-md border px-4 py-3 text-sm ${emailSaveResult.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                          {emailSaveResult.msg}
                        </div>
                      )}

                      <Button type="submit" disabled={emailSaving}>
                        {emailSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save & Connect"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
