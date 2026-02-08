"use client";

import React from "react";
import Link from "next/link";
import { Monitor, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalProvider, usePortal } from "@/lib/portal-context";

function PortalHeader() {
  const { isLoggedIn, contact, logout } = usePortal();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/portal" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Monitor className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-gray-900">ServiceDesk Portal</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {contact?.name}
                </span>
                <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/portal/login">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <LogIn className="h-4 w-4" />
                  Client Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PortalHeader />

        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Powered by Digital Panda MSP Service Desk
              </p>
              <Link href="/login" className="text-sm text-primary hover:underline">
                Staff Login
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </PortalProvider>
  );
}
