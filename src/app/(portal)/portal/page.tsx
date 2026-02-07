"use client";

import Link from "next/link";
import { Plus, Search, Ticket } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { usePortal } from "../layout";

export default function PortalHomePage() {
  const { isLoggedIn } = usePortal();

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center py-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          IT Support Portal
        </h1>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
          Submit a ticket or check the status of an existing request
        </p>
      </div>

      {/* Action cards */}
      <div className={`grid gap-6 ${isLoggedIn ? "sm:grid-cols-3" : "sm:grid-cols-2"} max-w-3xl mx-auto`}>
        {/* Submit a Ticket */}
        <Link href="/portal/submit" className="group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30 cursor-pointer">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Submit a Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-sm">
                Log a new support request
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {/* Check Ticket Status */}
        <Link href="/portal/status" className="group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30 cursor-pointer">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Search className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Check Ticket Status</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-sm">
                Look up your ticket by number
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {/* My Company Tickets (only if logged in) */}
        {isLoggedIn && (
          <Link href="/portal/dashboard" className="group">
            <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30 cursor-pointer">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Ticket className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-xl">My Company Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-sm">
                  View all tickets for your organisation
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
