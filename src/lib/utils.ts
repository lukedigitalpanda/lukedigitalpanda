import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function generateTicketNumber(): string {
  return `TKT-${Date.now().toString(36).toUpperCase()}`;
}

const FALLBACK_SLA: Record<string, Record<string, number>> = {
  CRITICAL: { Gold: 1, Silver: 2, Bronze: 4 },
  HIGH: { Gold: 4, Silver: 8, Bronze: 16 },
  MEDIUM: { Gold: 8, Silver: 24, Bronze: 48 },
  LOW: { Gold: 24, Silver: 48, Bronze: 72 },
};

export function calculateSLADeadline(
  priority: string,
  slaLevel?: string | null,
  slaMatrix?: Record<string, Record<string, number>>
): Date {
  const now = new Date();
  const matrix = slaMatrix ?? FALLBACK_SLA;
  const level = slaLevel || "Silver";
  const hours = matrix[priority]?.[level] ?? 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/** Async version that reads the SLA matrix from database settings */
export async function calculateSLADeadlineAsync(
  priority: string,
  slaLevel?: string | null
): Promise<Date> {
  try {
    const { loadSLAMatrix } = await import("@/app/api/settings/sla/route");
    const matrix = await loadSLAMatrix();
    return calculateSLADeadline(priority, slaLevel, matrix as Record<string, Record<string, number>>);
  } catch {
    return calculateSLADeadline(priority, slaLevel);
  }
}

export function isSLABreached(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() > new Date(deadline);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    WAITING_ON_CLIENT: "bg-orange-100 text-orange-800",
    WAITING_ON_VENDOR: "bg-purple-100 text-purple-800",
    RESOLVED: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-100 text-gray-800",
    // Change request statuses
    DRAFT: "bg-gray-100 text-gray-800",
    SUBMITTED: "bg-blue-100 text-blue-800",
    UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return colors[priority] || "bg-gray-100 text-gray-700";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
