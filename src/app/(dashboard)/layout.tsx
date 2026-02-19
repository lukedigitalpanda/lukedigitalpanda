"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Ticket,
  Building2,
  HardDrive,
  GitPullRequest,
  BookOpen,
  BarChart3,
  Settings,
  Monitor,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  CheckCheck,
  X,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Assets", href: "/assets", icon: HardDrive },
];

const operationsNavItems: NavItem[] = [
  { label: "Change Requests", href: "/change-requests", icon: GitPullRequest },
  { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
];

const reportsNavItems: NavItem[] = [
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Audit Log", href: "/audit-log", icon: ClipboardList },
];

function SidebarLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function SidebarSection({
  title,
  items,
  collapsed,
  pathname,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
      )}
      {items.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          collapsed={collapsed}
          isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
        />
      ))}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; time: string; read: boolean; href: string }[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";

  // Load read notification IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dp_read_notifications");
      if (stored) setReadIds(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  // Persist read IDs to localStorage
  function persistReadIds(ids: Set<string>) {
    setReadIds(ids);
    try {
      localStorage.setItem("dp_read_notifications", JSON.stringify([...ids]));
    } catch {}
  }

  function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/tickets?page=1&limit=10&sort=createdAt&order=desc");
        if (!res.ok) return;
        const data = await res.json();
        const tickets = Array.isArray(data) ? data : data.tickets || [];
        setNotifications(
          tickets.map((t: any) => ({
            id: t.id,
            message: `Ticket #${t.number}: ${t.subject}`,
            time: t.createdAt,
            read: readIds.has(t.id) || ["RESOLVED", "CLOSED"].includes(t.status),
            href: `/tickets/${t.id}`,
          }))
        );
      } catch {
        // Silently fail - notifications are non-critical
      }
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [readIds]);

  function markAllRead() {
    const newIds = new Set(readIds);
    notifications.forEach((n) => newIds.add(n.id));
    persistReadIds(newIds);
  }

  function clearNotifications() {
    markAllRead();
    setNotificationsOpen(false);
  }

  const unreadCount = notifications.filter(
    (n) => !n.read && !readIds.has(n.id)
  ).length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-slate-800 bg-slate-900 text-white transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Monitor className="h-6 w-6 shrink-0 text-blue-400" />
            {!collapsed && (
              <span className="text-lg font-bold tracking-tight">
                Digital Panda
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
          <SidebarSection
            title="Main"
            items={mainNavItems}
            collapsed={collapsed}
            pathname={pathname}
          />
          <SidebarSection
            title="Operations"
            items={operationsNavItems}
            collapsed={collapsed}
            pathname={pathname}
          />
          <SidebarSection
            title="Reports"
            items={reportsNavItems}
            collapsed={collapsed}
            pathname={pathname}
          />
        </nav>

        {/* Bottom Settings */}
        <div className="border-t border-slate-800 px-2 py-4">
          <SidebarLink
            item={{ label: "Settings", href: "/settings", icon: Settings }}
            collapsed={collapsed}
            isActive={
              pathname === "/settings" || pathname.startsWith("/settings/")
            }
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets, clients, assets..."
                className="h-9 w-80 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setUserMenuOpen(false);
                }}
                className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Notifications
                      </p>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Mark all as read"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={clearNotifications}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="Dismiss all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        No recent activity
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((notif) => {
                          const isRead = notif.read || readIds.has(notif.id);
                          return (
                            <Link
                              key={notif.id}
                              href={notif.href}
                              className={`block border-b px-4 py-3 text-sm transition-colors hover:bg-slate-50 ${
                                !isRead ? "bg-blue-50/50" : ""
                              }`}
                              onClick={() => {
                                const newIds = new Set(readIds);
                                newIds.add(notif.id);
                                persistReadIds(newIds);
                                setNotificationsOpen(false);
                              }}
                            >
                              <div className="flex items-start gap-2">
                                {!isRead && (
                                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-slate-800">
                                    {notif.message}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {formatTimeAgo(notif.time)}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    <Link
                      href="/tickets"
                      className="block border-t px-4 py-2 text-center text-xs font-medium text-blue-600 hover:bg-slate-50"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View all tickets
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* User Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 rounded-md p-1 hover:bg-slate-100"
                aria-label="User menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                  <User className="h-4 w-4" />
                </div>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-white py-1 shadow-lg">
                    <div className="border-b px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {userName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {userEmail}
                      </p>
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setUserMenuOpen(false);
                        window.location.href = "/api/auth/signout";
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
