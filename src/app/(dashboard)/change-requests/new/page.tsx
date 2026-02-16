"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption {
  id: string;
  name: string;
}

interface FormData {
  title: string;
  description: string;
  reason: string;
  type: string;
  priority: string;
  risk: string;
  clientId: string;
  implementationPlan: string;
  rollbackPlan: string;
  testingPlan: string;
  scheduledStart: string;
  scheduledEnd: string;
}

const initialForm: FormData = {
  title: "",
  description: "",
  reason: "",
  type: "STANDARD",
  priority: "MEDIUM",
  risk: "LOW",
  clientId: "",
  implementationPlan: "",
  rollbackPlan: "",
  testingPlan: "",
  scheduledStart: "",
  scheduledEnd: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewChangeRequestPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initialForm);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [changeTypes, setChangeTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients and categories on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data ?? [];
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      } catch {
        // silently fail
      }
    }
    async function fetchCategories() {
      try {
        const res = await fetch("/api/settings/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.changeTypes) setChangeTypes(data.changeTypes);
        }
      } catch {
        // silently fail
      }
    }
    fetchClients();
    fetchCategories();
  }, []);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        reason: form.reason,
        type: form.type,
        priority: form.priority,
        risk: form.risk,
        clientId: form.clientId,
        implementationPlan: form.implementationPlan || undefined,
        rollbackPlan: form.rollbackPlan || undefined,
        testingPlan: form.testingPlan || undefined,
        scheduledStart: form.scheduledStart
          ? new Date(form.scheduledStart).toISOString()
          : undefined,
        scheduledEnd: form.scheduledEnd
          ? new Date(form.scheduledEnd).toISOString()
          : undefined,
      };

      const res = await fetch("/api/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Failed to create (${res.status})`);
      }

      const created = await res.json();
      router.push(`/change-requests/${created.id}`);
    } catch (err) {
      console.error("Create change request error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/change-requests"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Change Requests
      </Link>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>New Change Request</CardTitle>
            <CardDescription>
              Submit a new change request for review and approval.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error banner */}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief summary of the change"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the change"
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                required
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Change *</Label>
              <Textarea
                id="reason"
                placeholder="Why is this change needed?"
                rows={3}
                value={form.reason}
                onChange={(e) => updateField("reason", e.target.value)}
                required
              />
            </div>

            {/* Type / Priority / Risk row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => updateField("type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {changeTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => updateField("priority", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Risk *</Label>
                <Select
                  value={form.risk}
                  onValueChange={(v) => updateField("risk", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => updateField("clientId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Implementation Plan */}
            <div className="space-y-2">
              <Label htmlFor="implementationPlan">Implementation Plan</Label>
              <Textarea
                id="implementationPlan"
                placeholder="Step-by-step implementation plan"
                rows={4}
                value={form.implementationPlan}
                onChange={(e) =>
                  updateField("implementationPlan", e.target.value)
                }
              />
            </div>

            {/* Rollback Plan */}
            <div className="space-y-2">
              <Label htmlFor="rollbackPlan">Rollback Plan</Label>
              <Textarea
                id="rollbackPlan"
                placeholder="How to revert the change if it fails"
                rows={4}
                value={form.rollbackPlan}
                onChange={(e) => updateField("rollbackPlan", e.target.value)}
              />
            </div>

            {/* Testing Plan */}
            <div className="space-y-2">
              <Label htmlFor="testingPlan">Testing Plan</Label>
              <Textarea
                id="testingPlan"
                placeholder="How to verify the change was successful"
                rows={4}
                value={form.testingPlan}
                onChange={(e) => updateField("testingPlan", e.target.value)}
              />
            </div>

            {/* Scheduled dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scheduledStart">Scheduled Start</Label>
                <Input
                  id="scheduledStart"
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) =>
                    updateField("scheduledStart", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledEnd">Scheduled End</Label>
                <Input
                  id="scheduledEnd"
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(e) => updateField("scheduledEnd", e.target.value)}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Link href="/change-requests">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Change Request"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
