"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface PortalContact {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
}

export interface PortalClient {
  id: string;
  name: string;
  slaLevel?: string;
  contractType?: string;
}

export interface PortalSession {
  token: string | null;
  contact: PortalContact | null;
  client: PortalClient | null;
  role: string | null;
  isLoggedIn: boolean;
  login: (data: { token: string; contact: PortalContact; client: PortalClient; role: string }) => void;
  logout: () => void;
}

export const PortalContext = createContext<PortalSession>({
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

const STORAGE_KEY = "portal_session";

export function PortalProvider({ children }: { children: React.ReactNode }) {
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
      {children}
    </PortalContext.Provider>
  );
}
