"use client";

import { useEffect, useState } from "react";
import { Plus, Search, BookOpen, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime, truncate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  isPublic: boolean;
  clientId: string | null;
  client?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  author: { name: string };
}

interface ClientOption {
  id: string;
  name: string;
}

interface NewArticleForm {
  title: string;
  category: string;
  content: string;
  tags: string;
  isPublic: boolean;
  clientId: string;
}

const emptyForm: NewArticleForm = {
  title: "",
  category: "General",
  content: "",
  tags: "",
  isPublic: false,
  clientId: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    Network: "bg-blue-100 text-blue-800",
    Hardware: "bg-purple-100 text-purple-800",
    Software: "bg-green-100 text-green-800",
    Security: "bg-red-100 text-red-800",
    General: "bg-gray-100 text-gray-800",
    "How-To": "bg-yellow-100 text-yellow-800",
    Email: "bg-indigo-100 text-indigo-800",
    Backup: "bg-teal-100 text-teal-800",
    Printing: "bg-pink-100 text-pink-800",
    "Account/Access": "bg-orange-100 text-orange-800",
    Policy: "bg-slate-100 text-slate-800",
  };
  return colors[category || ""] || "bg-gray-100 text-gray-800";
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Categories from settings API
  const [categories, setCategories] = useState<string[]>([]);

  // Client options for assignment
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // View dialog
  const [selectedArticle, setSelectedArticle] =
    useState<KnowledgeArticle | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // New article dialog
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<NewArticleForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Load categories from settings API
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/settings/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.knowledgeCategories || []);
        }
      } catch {
        // Use empty array; form will still work
      }
    }
    loadCategories();
  }, []);

  // Load clients for assignment dropdown
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients?limit=100");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.clients ?? data.data ?? [];
          setClients(list.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch {
        // Clients dropdown will just be empty
      }
    }
    loadClients();
  }, []);

  async function fetchArticles() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/knowledge");
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.articles ?? json.data ?? [];
      setArticles(list);
    } catch (err) {
      console.error("Knowledge base fetch error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArticles();
  }, []);

  function updateField<K extends keyof NewArticleForm>(
    key: K,
    value: NewArticleForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Insert image as base64 data URL into content
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const imageMarkdown = `\n![${file.name}](${dataUrl})\n`;
      updateField("content", form.content + imageMarkdown);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        category: form.category,
        content: form.content,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isPublic: form.isPublic,
        clientId: form.clientId || null,
      };

      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Failed to create (${res.status})`);

      setNewOpen(false);
      setForm(emptyForm);
      await fetchArticles();
    } catch (err) {
      console.error("Create article error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // Filter articles by search
  const filtered = articles.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      (a.category && a.category.toLowerCase().includes(q)) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Articles, guides, and documentation
          </p>
        </div>

        {/* New Article Dialog Trigger */}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Knowledge Article</DialogTitle>
              <DialogDescription>
                Create a new article for the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-title">Title *</Label>
                <Input
                  id="new-title"
                  placeholder="Article title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => updateField("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.length > 0
                      ? categories
                      : ["Network", "Hardware", "Software", "Security", "General", "How-To"]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-content">Content *</Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Add Image
                    </span>
                  </label>
                </div>
                <Textarea
                  id="new-content"
                  placeholder="Article content... (supports markdown with images)"
                  rows={10}
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-tags">Tags (comma separated)</Label>
                <Input
                  id="new-tags"
                  placeholder="e.g. vpn, networking, firewall"
                  value={form.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Assign to Client (optional)</Label>
                <Select
                  value={form.clientId || "none"}
                  onValueChange={(v) => updateField("clientId", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No client (internal)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client (internal)</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assigned articles appear only in that client&apos;s portal.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="new-public"
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => updateField("isPublic", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="new-public" className="cursor-pointer">
                  Make publicly visible (all client portals)
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Article"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-lg font-medium text-destructive">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => fetchArticles()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && <GridSkeleton />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">
              {searchQuery
                ? "No articles match your search"
                : "No articles yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? "Try a different search term."
                : "Create your first knowledge base article to get started."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Articles grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <Card
              key={article.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                setSelectedArticle(article);
                setViewOpen(true);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="line-clamp-2 text-base">
                  {article.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={getCategoryColor(article.category)}
                    variant="secondary"
                  >
                    {article.category || "Uncategorized"}
                  </Badge>
                  {article.isPublic && (
                    <Badge variant="outline" className="text-xs">
                      Public
                    </Badge>
                  )}
                  {article.client && (
                    <Badge variant="outline" className="text-xs">
                      {article.client.name}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {truncate(article.content.replace(/!\[.*?\]\(data:.*?\)/g, "[image]"), 150)}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{article.author.name}</span>
                  <span>{formatRelativeTime(article.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Article Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedArticle.title}</DialogTitle>
                <DialogDescription>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={getCategoryColor(selectedArticle.category)}
                      variant="secondary"
                    >
                      {selectedArticle.category || "Uncategorized"}
                    </Badge>
                    {selectedArticle.isPublic && (
                      <Badge variant="outline" className="text-xs">Public</Badge>
                    )}
                    {selectedArticle.client && (
                      <Badge variant="outline" className="text-xs">{selectedArticle.client.name}</Badge>
                    )}
                    <span>by {selectedArticle.author.name}</span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(selectedArticle.updatedAt)}
                    </span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="prose prose-sm max-w-none">
                {selectedArticle.content.split("\n").map((line, i) => {
                  const imgMatch = line.match(/!\[(.*?)\]\((data:image\/[^)]+)\)/);
                  if (imgMatch) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={imgMatch[2]}
                        alt={imgMatch[1]}
                        className="max-w-full rounded-lg border my-2"
                      />
                    );
                  }
                  if (!line.trim()) return <br key={i} />;
                  return <p key={i} className="whitespace-pre-wrap my-1">{line}</p>;
                })}
              </div>
              {selectedArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t pt-4">
                  {selectedArticle.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
