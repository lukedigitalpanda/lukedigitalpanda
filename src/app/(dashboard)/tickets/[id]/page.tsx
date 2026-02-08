"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Clock,
  Sparkles,
  MessageSquare,
  Activity,
  Timer,
  Paperclip,
  CheckCircle,
  AlertCircle,
  User,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  getStatusColor,
  getPriorityColor,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";
import { FileUpload, AttachmentList } from "@/components/ui/file-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TicketComment {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

interface TicketActivity {
  id: string;
  action: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface TimeEntry {
  id: string;
  minutes: number;
  description: string;
  billable: boolean;
  date: string;
  user: {
    id: string;
    name: string;
  };
}

interface TicketDetail {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string | null;
  slaBreached: boolean;
  client: {
    id: string;
    name: string;
  };
  contact: {
    id: string;
    name: string;
  } | null;
  assignee: {
    id: string;
    name: string;
  } | null;
  comments: TicketComment[];
  activities: TicketActivity[];
  timeEntries: TimeEntry[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  // Ticket data
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  // Time entry form
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDescription, setTimeDescription] = useState("");
  const [timeBillable, setTimeBillable] = useState(true);
  const [addingTime, setAddingTime] = useState(false);

  // AI features
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Sidebar edits
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // ---------- Fetch ticket --------------------------------------------------
  useEffect(() => {
    async function fetchTicket() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/tickets/${ticketId}`);
        if (!res.ok) throw new Error("Failed to load ticket");
        const data: TicketDetail = await res.json();
        setTicket(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setLoading(false);
      }
    }

    if (ticketId) fetchTicket();
  }, [ticketId]);

  // ---------- Handlers ------------------------------------------------------

  async function handleStatusChange(newStatus: string) {
    if (!ticket || newStatus === ticket.status) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    if (!ticket || newPriority === ticket.priority) return;
    try {
      setUpdatingPriority(true);
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) throw new Error("Failed to update priority");
      const updated = await res.json();
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      console.error("Priority update error:", err);
    } finally {
      setUpdatingPriority(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setSendingComment(true);
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentText.trim(),
          isInternal,
        }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      const newComment: TicketComment = await res.json();
      setTicket((prev) =>
        prev
          ? { ...prev, comments: [...prev.comments, newComment] }
          : prev
      );
      setCommentText("");
      setIsInternal(false);
    } catch (err) {
      console.error("Add comment error:", err);
    } finally {
      setSendingComment(false);
    }
  }

  async function handleAddTimeEntry(e: React.FormEvent) {
    e.preventDefault();
    const mins = parseInt(timeMinutes, 10);
    if (!mins || mins <= 0) return;

    try {
      setAddingTime(true);
      const res = await fetch(`/api/tickets/${ticketId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: mins,
          description: timeDescription.trim(),
          billable: timeBillable,
        }),
      });
      if (!res.ok) throw new Error("Failed to log time");
      const newEntry: TimeEntry = await res.json();
      setTicket((prev) =>
        prev
          ? { ...prev, timeEntries: [...prev.timeEntries, newEntry] }
          : prev
      );
      setTimeMinutes("");
      setTimeDescription("");
      setTimeBillable(true);
    } catch (err) {
      console.error("Add time entry error:", err);
    } finally {
      setAddingTime(false);
    }
  }

  async function handleSummarize() {
    try {
      setSummarizing(true);
      setAiSummary(null);
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (!res.ok) throw new Error("Summarization failed");
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (err) {
      console.error("Summarize error:", err);
    } finally {
      setSummarizing(false);
    }
  }

  async function handleSuggestResponse() {
    try {
      setSuggesting(true);
      setAiSuggestion(null);
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (!res.ok) throw new Error("Suggestion failed");
      const data = await res.json();
      setAiSuggestion(data.suggestion);
    } catch (err) {
      console.error("Suggest error:", err);
    } finally {
      setSuggesting(false);
    }
  }

  function handleCopySuggestion() {
    if (aiSuggestion) {
      navigator.clipboard.writeText(aiSuggestion);
    }
  }

  // ---------- Loading & Error states ----------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-6 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="w-80 space-y-4">
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">
              {error || "Ticket not found"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/tickets")}
            >
              Return to Tickets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Render --------------------------------------------------------

  const slaBreached =
    ticket.slaBreached ||
    (ticket.slaDeadline && new Date(ticket.slaDeadline) <= new Date());

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/tickets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tickets
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-muted-foreground">#{ticket.number}</span>{" "}
          {ticket.subject}
        </h1>
        <div className="flex items-center gap-2">
          <Badge
            className={getStatusColor(ticket.status)}
            variant="secondary"
          >
            {formatStatusLabel(ticket.status)}
          </Badge>
          <Badge
            className={getPriorityColor(ticket.priority)}
            variant="secondary"
          >
            {ticket.priority}
          </Badge>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ================================================================ */}
        {/* LEFT PANEL                                                        */}
        {/* ================================================================ */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {ticket.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No description provided.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Comments
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="time" className="gap-1.5">
                <Timer className="h-4 w-4" />
                Time Entries
              </TabsTrigger>
              <TabsTrigger value="attachments" className="gap-1.5">
                <Paperclip className="h-4 w-4" />
                Attachments
                {ticket.attachments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5">
                    {ticket.attachments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ------- Comments Tab ------- */}
            <TabsContent value="comments" className="space-y-4">
              {ticket.comments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No comments yet. Be the first to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {ticket.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={cn(
                        "rounded-lg border p-4",
                        comment.isInternal && "border-yellow-200 bg-yellow-50"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium">
                            {comment.author.name}
                          </span>
                          {comment.isInternal && (
                            <Badge
                              variant="outline"
                              className="border-yellow-300 text-yellow-700"
                            >
                              Internal
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-3">
                <Textarea
                  placeholder="Write a comment..."
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Internal Note
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sendingComment || !commentText.trim()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sendingComment ? "Sending..." : "Send"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ------- Activity Tab ------- */}
            <TabsContent value="activity">
              {ticket.activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {ticket.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-lg border p-4"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Activity className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">
                            {activity.user.name}
                          </span>{" "}
                          {activity.description}
                        </p>
                        {(activity.oldValue || activity.newValue) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity.oldValue && (
                              <span className="line-through">
                                {activity.oldValue}
                              </span>
                            )}
                            {activity.oldValue && activity.newValue && " \u2192 "}
                            {activity.newValue && (
                              <span className="font-medium">
                                {activity.newValue}
                              </span>
                            )}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ------- Time Entries Tab ------- */}
            <TabsContent value="time" className="space-y-4">
              {ticket.timeEntries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No time entries logged yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Minutes</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Billable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ticket.timeEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 font-medium">
                            {entry.user.name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {entry.minutes}m
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                            {entry.description || "\u2014"}
                          </td>
                          <td className="px-4 py-3">
                            {entry.billable ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-700"
                              >
                                Billable
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Non-billable</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Log time form */}
              <form
                onSubmit={handleAddTimeEntry}
                className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Minutes
                  </label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="30"
                    className="w-24"
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description
                  </label>
                  <Input
                    placeholder="What did you work on?"
                    value={timeDescription}
                    onChange={(e) => setTimeDescription(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={timeBillable}
                    onChange={(e) => setTimeBillable(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Billable
                </label>
                <Button
                  type="submit"
                  size="sm"
                  disabled={addingTime || !timeMinutes}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {addingTime ? "Adding..." : "Add"}
                </Button>
              </form>
            </TabsContent>

            {/* ------- Attachments Tab ------- */}
            <TabsContent value="attachments" className="space-y-4">
              <AttachmentList attachments={ticket.attachments} />
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-3">Upload Files</p>
                <FileUpload
                  ticketId={ticket.id}
                  onUpload={(attachment) => {
                    setTicket((prev) =>
                      prev
                        ? {
                            ...prev,
                            attachments: [...prev.attachments, attachment],
                          }
                        : prev
                    );
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ================================================================ */}
        {/* RIGHT SIDEBAR                                                     */}
        {/* ================================================================ */}
        <div className="w-full space-y-4 lg:w-80">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="WAITING_ON_CLIENT">
                      Waiting on Client
                    </SelectItem>
                    <SelectItem value="WAITING_ON_VENDOR">
                      Waiting on Vendor
                    </SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Priority
                </label>
                <Select
                  value={ticket.priority}
                  onValueChange={handlePriorityChange}
                  disabled={updatingPriority}
                >
                  <SelectTrigger className="h-9">
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

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Assignee
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200">
                    <User className="h-3 w-3 text-slate-500" />
                  </div>
                  <span>
                    {ticket.assignee?.name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Client
                </label>
                <Link
                  href={`/clients/${ticket.client.id}`}
                  className="block text-sm font-medium text-primary hover:underline"
                >
                  {ticket.client.name}
                </Link>
              </div>

              {/* Contact */}
              {ticket.contact && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Contact
                  </label>
                  <p className="text-sm">{ticket.contact.name}</p>
                </div>
              )}

              {/* Source */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Source
                </label>
                <div>
                  <Badge variant="outline">{ticket.source}</Badge>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Created
                </label>
                <p className="text-sm text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Updated
                </label>
                <p className="text-sm text-muted-foreground">
                  {formatDate(ticket.updatedAt)}
                </p>
              </div>

              {/* SLA Deadline */}
              {ticket.slaDeadline && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SLA Deadline
                  </label>
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium",
                      slaBreached ? "text-red-600" : "text-foreground"
                    )}
                  >
                    {slaBreached ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {formatDate(ticket.slaDeadline)}
                    {slaBreached && (
                      <span className="text-xs">(Breached)</span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                AI Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Summarize */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleSummarize}
                disabled={summarizing}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {summarizing ? "Summarizing..." : "Summarize"}
              </Button>
              {aiSummary && (
                <div className="rounded-md border bg-blue-50 p-3 text-sm leading-relaxed text-blue-900">
                  {aiSummary}
                </div>
              )}

              {/* Suggest Response */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleSuggestResponse}
                disabled={suggesting}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {suggesting ? "Generating..." : "Suggest Response"}
              </Button>
              {aiSuggestion && (
                <div className="space-y-2">
                  <div className="rounded-md border bg-green-50 p-3 text-sm leading-relaxed text-green-900">
                    {aiSuggestion}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleCopySuggestion}
                  >
                    Copy to clipboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
