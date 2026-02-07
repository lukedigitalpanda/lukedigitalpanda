"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Send, Clock, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusColor, getPriorityColor, formatDate, formatRelativeTime } from "@/lib/utils";
import { usePortal } from "../../layout";

interface TicketComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  client: string;
  contact: string | null;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  comments: TicketComment[];
}

export default function PortalStatusPage() {
  const { token } = usePortal();

  const [ticketNumber, setTicketNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);

  // Reply state
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTicket(null);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["x-portal-token"] = token;
      }

      const res = await fetch(
        `/api/portal/tickets/${encodeURIComponent(ticketNumber.trim())}?email=${encodeURIComponent(email.trim())}`,
        { headers }
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Ticket not found. Please check the ticket number and try again.");
        }
        if (res.status === 403) {
          throw new Error("Access denied. The email address does not match the ticket contact.");
        }
        throw new Error(data.error || "Failed to look up ticket");
      }

      setTicket(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyContent.trim()) return;

    setReplyLoading(true);
    setReplyError(null);
    setReplySuccess(false);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["x-portal-token"] = token;
      }

      const res = await fetch(`/api/portal/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: replyContent.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add reply");
      }

      // Refresh the ticket to get updated comments
      const refreshRes = await fetch(
        `/api/portal/tickets/${ticket.number}?email=${encodeURIComponent(email.trim())}`,
        { headers: token ? { "x-portal-token": token } : {} }
      );

      if (refreshRes.ok) {
        const refreshedTicket = await refreshRes.json();
        setTicket(refreshedTicket);
      }

      setReplyContent("");
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 3000);
    } catch (err: any) {
      setReplyError(err.message || "Failed to send reply.");
    } finally {
      setReplyLoading(false);
    }
  };

  const formatStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>

      {/* Lookup form */}
      {!ticket && (
        <Card>
          <CardHeader>
            <CardTitle>Check Ticket Status</CardTitle>
            <CardDescription>
              Enter your ticket number and the email address used when submitting to look up your ticket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticketNumber">Ticket Number</Label>
                <Input
                  id="ticketNumber"
                  type="number"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="e.g. 1234"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="The email used when submitting"
                  required
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Look Up
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ticket detail */}
      {ticket && (
        <div className="space-y-4">
          {/* Ticket header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Ticket #{ticket.number}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {ticket.subject}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={cn(getStatusColor(ticket.status), "border-0")}>
                    {formatStatusLabel(ticket.status)}
                  </Badge>
                  <Badge className={cn(getPriorityColor(ticket.priority), "border-0")}>
                    {ticket.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
                <div>
                  <p className="text-gray-500 font-medium">Category</p>
                  <p className="text-gray-900">{ticket.category || "Uncategorised"}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Assigned To</p>
                  <p className="text-gray-900">{ticket.assignee}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Created</p>
                  <p className="text-gray-900">{formatDate(ticket.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Last Updated</p>
                  <p className="text-gray-900">{formatRelativeTime(ticket.updatedAt)}</p>
                </div>
                {ticket.resolvedAt && (
                  <div>
                    <p className="text-gray-500 font-medium">Resolved</p>
                    <p className="text-gray-900">{formatDate(ticket.resolvedAt)}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comments / Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comments &amp; Updates</CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No updates yet. Your ticket is being reviewed.
                </p>
              ) : (
                <div className="space-y-4">
                  {ticket.comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {comment.author}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(comment.createdAt)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap pl-9">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add reply form */}
              {ticket.status !== "CLOSED" && (
                <div className="border-t mt-6 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Add a Reply</h4>
                  <form onSubmit={handleReply} className="space-y-3">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={3}
                      placeholder="Type your reply here..."
                      required
                    />

                    {replyError && (
                      <div className="rounded-md bg-red-50 border border-red-200 p-3">
                        <p className="text-sm text-red-700">{replyError}</p>
                      </div>
                    )}

                    {replySuccess && (
                      <div className="rounded-md bg-green-50 border border-green-200 p-3">
                        <p className="text-sm text-green-700">Reply sent successfully.</p>
                      </div>
                    )}

                    <Button type="submit" size="sm" disabled={replyLoading} className="gap-1.5">
                      {replyLoading ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Back to lookup */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setTicket(null);
                setTicketNumber("");
                setError(null);
              }}
              className="gap-1.5 text-gray-600"
            >
              <Search className="h-4 w-4" />
              Look up another ticket
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
