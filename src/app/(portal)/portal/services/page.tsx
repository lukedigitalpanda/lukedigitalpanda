"use client";

import Link from "next/link";
import { ArrowLeft, Package, Shield, Cloud, Headphones, Wrench, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const services = [
  { name: "Managed IT Support", description: "Comprehensive IT support and monitoring for your business", icon: Headphones },
  { name: "Cyber Security", description: "Protect your business from cyber threats with enterprise-grade security", icon: Shield },
  { name: "Cloud Solutions", description: "Microsoft 365, Azure, and cloud migration services", icon: Cloud },
  { name: "Hardware & Procurement", description: "Sourcing, setup and deployment of IT equipment", icon: Package },
  { name: "Network Infrastructure", description: "Design, install and maintain your network infrastructure", icon: Globe },
  { name: "Break-Fix Support", description: "Pay-as-you-go IT support for ad-hoc issues", icon: Wrench },
];

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Services & Products</h1>
        <p className="text-sm text-gray-500 mt-1">Explore our range of IT services and solutions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const Icon = svc.icon;
          return (
            <Card key={svc.name} className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{svc.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{svc.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-gray-600">
            Interested in any of our services? Contact your account manager or{" "}
            <Link href="/portal/submit" className="text-primary hover:underline font-medium">submit a request</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
