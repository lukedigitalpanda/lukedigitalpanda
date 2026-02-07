"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Check, X, GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  getStatusColor,
  getPriorityColor,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangeRequestDetail {
  id: string;
  number: number;
  title: string;
  description: string;
  reason: string;
  type: string;
  status: string;
  priority: string;
  risk: string;
  implementationPlan: string | null;
  rollbackPlan: string | null;
  testingPlan: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  createdBy: { id: string; name: string };
  approver: { id: string; name: string } | null;
  comments: Comment[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
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

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="h-10 w-96 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-5 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content section component
// ---------------------------------------------------------------------------

function ContentSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
        {content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChangeRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ChangeRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Comments
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/change-requests/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const json: ChangeRequestDetail = await res.json();
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatusAction(newStatus: string) {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "APPROVED" || newStatus === "REJECTED") {
        body.approvalNotes = approvalNotes;
      }
      const res = await fetch(`/api/change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update (${res.status})`);
      await fetchData();
      setApprovalNotes("");
    } catch (err) {
      console.error("Status action error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/change-requests/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) throw new Error(`Failed to add comment (${res.status})`);
      setCommentText("");
      await fetchData();
    } catch (err) {
      console.error("Add comment error:", err);
    } finally {
      setCommentLoading(false);
    }
  }

  // Loading
  if (loading) {
    return <DetailSkeleton />;
  }

  // Error
  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link
          href="/change-requests"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Change Requests
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitPullRequest className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">
              {error || "Change request not found"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/change-requests")}
            >
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canApprove =
    data.status === "SUBMITTED" || data.status === "UNDER_REVIEW";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/change-requests"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Change Requests
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            CR-{data.number}{" "}
            <span className="font-normal text-muted-foreground">
              {data.title}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getTypeColor(data.type)} variant="secondary">
            {data.type}
          </Badge>
          <Badge className={getStatusColor(data.status)} variant="secondary">
            {formatStatusLabel(data.status)}
          </Badge>
          <Badge className={getRiskColor(data.risk)} variant="secondary">
            Risk: {data.risk}
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: content + actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description & Reason */}
          <Card>
            <CardContent className="space-y-6 p-6">
              <ContentSection title="Description" content={data.description} />
              <ContentSection title="Reason for Change" content={data.reason} />
              <ContentSection
                title="Implementation Plan"
                content={data.implementationPlan}
              />
              <ContentSection
                title="Rollback Plan"
                content={data.rollbackPlan}
              />
              <ContentSection
                title="Testing Plan"
                content={data.testingPlan}
              />
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Scheduled Start
                  </p>
                  <p className="text-sm">
                    {data.scheduledStart
                      ? formatDate(data.scheduledStart)
                      : "Not scheduled"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Scheduled End
                  </p>
                  <p className="text-sm">
                    {data.scheduledEnd
                      ? formatDate(data.scheduledEnd)
                      : "Not scheduled"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Actual Start
                  </p>
                  <p className="text-sm">
                    {data.actualStart
                      ? formatDate(data.actualStart)
                      : "Not started"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Actual End
                  </p>
                  <p className="text-sm">
                    {data.actualEnd
                      ? formatDate(data.actualEnd)
                      : "Not completed"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval Section */}
          {canApprove && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="approvalNotes">Approval Notes</Label>
                  <Textarea
                    id="approvalNotes"
                    placeholder="Add notes for approval or rejection..."
                    rows={3}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={actionLoading}
                    onClick={() => handleStatusAction("APPROVED")}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={actionLoading}
                    onClick={() => handleStatusAction("REJECTED")}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status workflow buttons */}
          {(data.status === "DRAFT" ||
            data.status === "APPROVED" ||
            data.status === "IN_PROGRESS") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {data.status === "DRAFT" && (
                    <Button
                      disabled={actionLoading}
                      onClick={() => handleStatusAction("SUBMITTED")}
                    >
                      Submit for Review
                    </Button>
                  )}
                  {data.status === "APPROVED" && (
                    <Button
                      disabled={actionLoading}
                      onClick={() => handleStatusAction("IN_PROGRESS")}
                    >
                      Start Implementation
                    </Button>
                  )}
                  {data.status === "IN_PROGRESS" && (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={actionLoading}
                      onClick={() => handleStatusAction("COMPLETED")}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Mark Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing comments */}
              {data.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {data.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border bg-muted/30 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {comment.author.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(comment.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={commentLoading || !commentText.trim()}
                >
                  {commentLoading ? "Adding..." : "Add Comment"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Status
                </p>
                <Badge
                  className={getStatusColor(data.status)}
                  variant="secondary"
                >
                  {formatStatusLabel(data.status)}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Priority
                </p>
                <Badge
                  className={getPriorityColor(data.priority)}
                  variant="secondary"
                >
                  {data.priority}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Risk
                </p>
                <Badge
                  className={getRiskColor(data.risk)}
                  variant="secondary"
                >
                  {data.risk}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Client
                </p>
                <p className="text-sm">{data.client.name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Creator
                </p>
                <p className="text-sm">{data.createdBy.name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Approver
                </p>
                <p className="text-sm">
                  {data.approver ? data.approver.name : "Not assigned"}
                </p>
              </div>

              {data.approvalNotes && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Approval Notes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.approvalNotes}
                  </p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Created
                  </p>
                  <p className="text-sm">{formatDate(data.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Updated
                  </p>
                  <p className="text-sm">{formatDate(data.updatedAt)}</p>
                </div>
                {data.approvedAt && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Approved
                    </p>
                    <p className="text-sm">{formatDate(data.approvedAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
