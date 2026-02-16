"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Article {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  createdAt: string;
  author: { name: string };
}

export default function PortalKnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        const res = await fetch("/api/portal/knowledge");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : data.articles || []);
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  const filtered = articles.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      (a.category || "").toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const categories = [...new Set(filtered.map((a) => a.category || "General"))];

  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search articles..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">Loading articles...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <BookOpen className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="font-semibold text-gray-700">No articles found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search ? "Try a different search term." : "No knowledge base articles are available yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catArticles = filtered.filter((a) => (a.category || "General") === cat);
            return (
              <div key={cat}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{cat}</h2>
                <div className="space-y-2">
                  {catArticles.map((article) => {
                    const isExpanded = expandedId === article.id;
                    return (
                      <Card key={article.id} className="overflow-hidden">
                        <button
                          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : article.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900">{article.title}</h3>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                              <span>By {article.author.name}</span>
                              <span>&middot;</span>
                              <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                              {article.tags.length > 0 && (
                                <>
                                  <span>&middot;</span>
                                  {article.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] py-0">{tag}</Badge>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
                        </button>
                        {isExpanded && (
                          <CardContent className="border-t bg-gray-50/50 pt-4">
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                              {article.content}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
