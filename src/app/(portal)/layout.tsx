"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Monitor, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalContact {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
}

interface PortalClient {
  id: string;
  name: string;
  slaLevel?: string;
  contractType?: string;
}

interface PortalSession {
  token: string | null;
  contact: PortalContact | null;
  client: PortalClient | null;
  role: string | null;
  isLoggedIn: boolean;
  login: (data: { token: string; contact: PortalContact; client: PortalClient; role: string }) => void;
  logout: () => void;
}

const PortalContext = createContext<PortalSession>({
  token: null,
  contact: null,
  client: null,
  role: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function usePortal() {
  return useContext(PortalContext);
}

export { PortalContext };

const STORAGE_KEY = "portal_session";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [contact, setContact] = useState<PortalContact | null>(null);
  const [client, setClient] = useState<PortalClient | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.contact && parsed.client) {
          setToken(parsed.token);
          setContact(parsed.contact);
          setClient(parsed.client);
          setRole(parsed.role || null);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setMounted(true);
  }, []);

  const login = useCallback(
    (data: { token: string; contact: PortalContact; client: PortalClient; role: string }) => {
      setToken(data.token);
      setContact(data.contact);
      setClient(data.client);
      setRole(data.role);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setContact(null);
    setClient(null);
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isLoggedIn = !!token && !!contact;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <PortalContext.Provider value={{ token, contact, client, role, isLoggedIn, login, logout }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
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
                      {contact.name}
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

        {/* Main content */}
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-gray-500">
              Powered by Digital Panda MSP Service Desk
            </p>
          </div>
        </footer>
      </div>
    </PortalContext.Provider>
  );
}
