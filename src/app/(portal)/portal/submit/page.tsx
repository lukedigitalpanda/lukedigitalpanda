"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle, Upload, X, FileIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/lib/portal-context";

interface TicketResult {
  id: string;
  number: number;
  subject: string;
  message: string;
}

export default function PortalSubmitPage() {
  const { isLoggedIn, contact } = usePortal();

  const [name, setName] = useState(isLoggedIn && contact ? contact.name : "");
  const [email, setEmail] = useState(isLoggedIn && contact ? contact.email : "");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          subject: subject.trim(),
          priority,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }

      // Upload any pending files
      if (data.id && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("ticketId", data.id);
            await fetch("/api/attachments", {
              method: "POST",
              headers: { "x-portal-upload": "true" },
              body: formData,
            });
          } catch {
            console.error(`Failed to upload attachment: ${file.name}`);
          }
        }
      }

      setResult({
        id: data.id,
        number: data.number,
        subject: data.subject,
        message: data.message,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(isLoggedIn && contact ? contact.name : "");
    setEmail(isLoggedIn && contact ? contact.email : "");
    setPhone("");
    setSubject("");
    setPriority("MEDIUM");
    setDescription("");
    setPendingFiles([]);
    setResult(null);
    setError(null);
  };

  // Success state
  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-green-900">
                  Ticket #{result.number} Created
                </CardTitle>
                <CardDescription className="text-green-700">
                  {result.subject}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Your ticket has been submitted. You&apos;ll receive updates via email.
            </p>
            <p className="text-sm text-green-700 mt-2">
              {result.message}
            </p>
          </CardContent>
          <CardFooter className="gap-3">
            <Button onClick={resetForm} variant="outline" className="gap-1.5">
              Submit Another Ticket
            </Button>
            <Link href="/portal/status">
              <Button variant="secondary" className="gap-1.5">
                Check Ticket Status
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Submit a Support Request</CardTitle>
          <CardDescription>
            Fill out the form below to log a new support ticket. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                disabled={isLoggedIn && !!contact}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                required
                disabled={isLoggedIn && !!contact}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                required
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Please describe your issue in detail..."
                required
              />
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
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-gray-400 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">
                  Click to add files (up to 25MB each)
                </p>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {pendingFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-2 rounded border bg-gray-50 px-3 py-1.5 text-sm"
                    >
                      <FileIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 hover:bg-gray-200"
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

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
