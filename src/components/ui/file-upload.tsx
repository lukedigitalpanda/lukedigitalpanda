"use client";

import { useState, useRef } from "react";
import { Upload, X, FileIcon, Image, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface FileUploadProps {
  ticketId: string;
  onUpload?: (attachment: UploadedFile) => void;
  isPortal?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return FileIcon;
}

export function FileUpload({
  ticketId,
  onUpload,
  isPortal = false,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name} exceeds 25MB limit`);
        continue;
      }

      try {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("ticketId", ticketId);

        const headers: Record<string, string> = {};
        if (isPortal) {
          headers["x-portal-upload"] = "true";
        }

        const res = await fetch("/api/attachments", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Upload failed");
        }

        const attachment: UploadedFile = await res.json();
        setUploadedFiles((prev) => [...prev, attachment]);
        onUpload?.(attachment);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Failed to upload ${file.name}`
        );
      } finally {
        setUploading(false);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Upload area */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          uploading
            ? "border-primary/50 bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.eml"
        />
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images, documents, PDFs up to 25MB
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file, idx) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Standalone attachment display component for ticket detail pages
export function AttachmentList({
  attachments,
}: {
  attachments: UploadedFile[];
}) {
  if (!attachments || attachments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No attachments on this ticket.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((file) => {
        const Icon = getFileIcon(file.mimeType);
        const isImage = file.mimeType.startsWith("image/");
        const isPdf = file.mimeType === "application/pdf";

        return (
          <div key={file.id} className="rounded-lg border overflow-hidden">
            {/* Image preview */}
            {isImage && (
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={file.fileUrl}
                  alt={file.fileName}
                  className="max-h-64 w-full object-contain bg-muted/50"
                />
              </a>
            )}

            {/* File info bar */}
            <div className="flex items-center gap-3 px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)}
                </p>
              </div>
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="outline" size="sm">
                  {isImage || isPdf ? "View" : "Download"}
                </Button>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
