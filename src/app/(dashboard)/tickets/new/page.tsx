"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, X, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

interface Client {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  name: string;
}

interface ClassifyResponse {
  category: string;
  priority: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewTicketPage() {
  const router = useRouter();

  // Form fields
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  // Data lists
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // File attachments (buffered until ticket is created)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients and technicians on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (res.ok) {
          const data = await res.json();
          setClients(Array.isArray(data) ? data : data.clients || []);
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    }

    async function fetchTechnicians() {
      try {
        const res = await fetch("/api/users?role=TECHNICIAN");
        if (res.ok) {
          const data = await res.json();
          setTechnicians(Array.isArray(data) ? data : data.users || []);
        }
      } catch (err) {
        console.error("Error fetching technicians:", err);
      }
    }

    fetchClients();
    fetchTechnicians();
  }, []);

  // AI classification
  async function handleClassify() {
    if (!subject && !description) return;

    try {
      setClassifying(true);
      setAiConfidence(null);

      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description }),
      });

      if (!res.ok) throw new Error("Classification failed");

      const data: ClassifyResponse = await res.json();
      if (data.category) setCategory(data.category);
      if (data.priority) setPriority(data.priority);
      if (data.confidence != null) setAiConfidence(data.confidence);
    } catch (err) {
      console.error("AI classification error:", err);
    } finally {
      setClassifying(false);
    }
  }

  // Submit form
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!clientId) {
      setError("Please select a client.");
      return;
    }

    try {
      setSubmitting(true);

      const body: Record<string, string> = {
        subject: subject.trim(),
        description: description.trim(),
        clientId,
        priority,
        category,
      };
      if (assigneeId && assigneeId !== "none") body.assigneeId = assigneeId;

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to create ticket");
      }

      const ticket = await res.json();

      // Upload any pending files
      for (const file of pendingFiles) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("ticketId", ticket.id);
          await fetch("/api/attachments", { method: "POST", body: formData });
        } catch {
          // Don't block redirect if an attachment upload fails
          console.error(`Failed to upload attachment: ${file.name}`);
        }
      }

      router.push(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create New Ticket</CardTitle>
          <CardDescription>
            Fill in the details below to create a new support ticket.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Error */}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of the issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about the issue..."
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority + Category row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
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
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Backup">Backup</SelectItem>
                    <SelectItem value="Printing">Printing</SelectItem>
                    <SelectItem value="Account Access">Account Access</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Classify */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClassify}
                disabled={classifying || (!subject && !description)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {classifying ? "Classifying..." : "Classify with AI"}
              </Button>
              {aiConfidence != null && (
                <span className="text-xs text-muted-foreground">
                  AI confidence: {Math.round(aiConfidence * 100)}%
                </span>
              )}
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee (optional)</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Leave unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.eml"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  const newFiles = Array.from(files).filter(
                    (f) => f.size <= 25 * 1024 * 1024
                  );
                  setPendingFiles((prev) => [...prev, ...newFiles]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">
                  Click to add files (up to 25MB each)
                </p>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {pendingFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          );
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/tickets")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Ticket"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
