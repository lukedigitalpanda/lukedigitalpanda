# NinjaOne RMM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate NinjaOne RMM with the MSP service desk — syncing organisations → Clients, devices → Assets, and auto-creating tickets from critical/major alerts on a 15-minute schedule.

**Architecture:** Background sync job (`ninjarmm-sync.ts`) following the existing `email-sync.ts` pattern. A Next.js `instrumentation.ts` file registers a `setInterval` at startup to run the sync every 15 minutes. NinjaOne credentials are stored as a JSON blob in the existing `Settings` table under key `ninjarmm_config`.

**Tech Stack:** Next.js 14 (App Router, standalone build), Prisma 5, PostgreSQL, NinjaOne REST API v2 with OAuth 2.0 Client Credentials.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `ninjaOrgId`, `ninjaDeviceId`, `ninjaSource`, `ninjaAlertId` |
| `src/lib/ninjarmm/ninjarmm-client.ts` | Create | OAuth token management + API fetch methods |
| `src/lib/ninjarmm/ninjarmm-sync.ts` | Create | 3-phase sync logic (orgs → devices → alerts) |
| `src/lib/jobs/ninjarmm-sync-job.ts` | Create | CLI entry point for manual/scripted runs |
| `src/instrumentation.ts` | Create | Next.js startup hook — registers 15-min interval |
| `src/app/api/integrations/ninjarmm/route.ts` | Create | GET/POST settings |
| `src/app/api/integrations/ninjarmm/test/route.ts` | Create | POST — test OAuth connection |
| `src/app/api/integrations/ninjarmm/sync/route.ts` | Create | POST — trigger immediate sync |
| `src/app/(dashboard)/settings/page.tsx` | Modify | Add "NinjaOne RMM" tab |
| `package.json` | Modify | Add `ninjarmm:sync` script |

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `ninjaOrgId` to the `Client` model**

  Open `prisma/schema.prisma`. In the `Client` model, after the `slaLevel` field add:

  ```prisma
  ninjaOrgId   String?  @unique
  ```

- [ ] **Step 2: Add `ninjaDeviceId` and `ninjaSource` to the `Asset` model**

  In the `Asset` model, after the `clientId` field add:

  ```prisma
  ninjaDeviceId String?  @unique
  ninjaSource   Boolean  @default(false)
  ```

- [ ] **Step 3: Add `ninjaAlertId` to the `Ticket` model**

  In the `Ticket` model, after the `aiConfidence` field add:

  ```prisma
  ninjaAlertId  String?  @unique
  ```

- [ ] **Step 4: Generate and apply migration**

  ```bash
  cd /opt/msp-service-desk
  npx prisma migrate dev --name add_ninjarmm_fields
  ```

  Expected: migration created and applied, `prisma generate` runs automatically.

- [ ] **Step 5: Verify TypeScript picks up new fields**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors related to ninjaOrgId / ninjaDeviceId / ninjaAlertId.

- [ ] **Step 6: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat: add NinjaOne RMM fields to Client, Asset, and Ticket models"
  ```

---

## Task 2: NinjaOne API client

**Files:**
- Create: `src/lib/ninjarmm/ninjarmm-client.ts`

- [ ] **Step 1: Create the file with types and class**

  Create `src/lib/ninjarmm/ninjarmm-client.ts`:

  ```typescript
  // NinjaOne REST API v2 client with OAuth 2.0 Client Credentials auth.
  // Token is cached in-process and refreshed 60 seconds before expiry.

  export interface NinjaOrg {
    id: number;
    name: string;
    description?: string;
    phoneNumber?: string;
    website?: string;
  }

  export interface NinjaDevice {
    id: number;
    organizationId: number;
    systemName: string;
    dnsName?: string;
    nodeClass: string;
    ipAddresses?: string;
    macAddresses?: string;
    system?: {
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
    };
    os?: {
      name?: string;
    };
  }

  export type NinjaAlertSeverity =
    | "NONE"
    | "INFORMATIONAL"
    | "MINOR"
    | "MODERATE"
    | "MAJOR"
    | "CRITICAL";

  export interface NinjaAlert {
    uid: string;
    deviceId?: number;
    organizationId?: number;
    severity: NinjaAlertSeverity;
    message: string;
    createTime?: number;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
  }

  export class NinjaRmmClient {
    private readonly instanceUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(config: {
      instanceUrl: string;
      clientId: string;
      clientSecret: string;
    }) {
      this.instanceUrl = config.instanceUrl;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
    }

    private async getToken(): Promise<string> {
      if (
        this.accessToken &&
        this.tokenExpiry &&
        this.tokenExpiry > new Date()
      ) {
        return this.accessToken;
      }
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: "monitoring management",
      });
      const res = await fetch(
        `https://${this.instanceUrl}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `NinjaOne OAuth failed (${res.status}): ${text}`
        );
      }
      const data = (await res.json()) as TokenResponse;
      this.accessToken = data.access_token;
      // Expire 60 s early to avoid using a token right as it expires
      this.tokenExpiry = new Date(
        Date.now() + (data.expires_in - 60) * 1000
      );
      return this.accessToken;
    }

    private async get<T>(path: string): Promise<T> {
      const token = await this.getToken();
      const res = await fetch(
        `https://${this.instanceUrl}/v2${path}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `NinjaOne API ${res.status} for ${path}: ${text}`
        );
      }
      return res.json() as Promise<T>;
    }

    async getOrganizations(): Promise<NinjaOrg[]> {
      return this.get<NinjaOrg[]>("/organizations");
    }

    async getDevices(): Promise<NinjaDevice[]> {
      return this.get<NinjaDevice[]>("/devices-detailed");
    }

    /** Returns only MAJOR and CRITICAL active alerts. */
    async getAlerts(): Promise<NinjaAlert[]> {
      const all = await this.get<NinjaAlert[]>("/alerts");
      return all.filter(
        (a) => a.severity === "MAJOR" || a.severity === "CRITICAL"
      );
    }

    /** Attempt a token fetch to validate credentials. Throws on failure. */
    async testConnection(): Promise<void> {
      this.accessToken = null; // force fresh fetch
      await this.getToken();
    }
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep ninjarmm-client
  ```

  Expected: no output (no errors).

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/ninjarmm/ninjarmm-client.ts
  git commit -m "feat: add NinjaOne RMM API client with OAuth token management"
  ```

---

## Task 3: Three-phase sync job

**Files:**
- Create: `src/lib/ninjarmm/ninjarmm-sync.ts`

- [ ] **Step 1: Create the file**

  Create `src/lib/ninjarmm/ninjarmm-sync.ts`:

  ```typescript
  import { AssetType } from "@prisma/client";
  import prisma from "@/lib/prisma";
  import {
    NinjaRmmClient,
    NinjaOrg,
    NinjaDevice,
    NinjaAlert,
  } from "./ninjarmm-client";

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  export interface NinjaRmmConfig {
    clientId: string;
    clientSecret: string;
    instanceUrl: string;
    enabled: boolean;
  }

  export const SETTINGS_KEY = "ninjarmm_config";
  export const LAST_SYNC_KEY = "ninjarmm_last_sync";

  export async function loadNinjaRmmConfig(): Promise<NinjaRmmConfig | null> {
    const row = await prisma.settings.findUnique({
      where: { key: SETTINGS_KEY },
    });
    if (!row) return null;
    return JSON.parse(row.value) as NinjaRmmConfig;
  }

  // ---------------------------------------------------------------------------
  // Result type
  // ---------------------------------------------------------------------------

  export interface SyncResult {
    success: boolean;
    orgsProcessed: number;
    clientsCreated: number;
    devicesProcessed: number;
    assetsUpserted: number;
    alertsProcessed: number;
    ticketsCreated: number;
    errors: string[];
    startedAt: Date;
    completedAt: Date;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function mapDeviceClass(nodeClass: string): AssetType {
    const map: Record<string, AssetType> = {
      WINDOWS_WORKSTATION: "WORKSTATION",
      MAC: "WORKSTATION",
      WINDOWS_LAPTOP: "LAPTOP",
      MAC_LAPTOP: "LAPTOP",
      WINDOWS_SERVER: "SERVER",
      LINUX_SERVER: "SERVER",
      NMS_SWITCH: "NETWORK_DEVICE",
      NMS_ROUTER: "NETWORK_DEVICE",
      NMS_FIREWALL: "NETWORK_DEVICE",
      MOBILE_DEVICE: "MOBILE_DEVICE",
    };
    return map[nodeClass] ?? "OTHER";
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Organisation sync
  // ---------------------------------------------------------------------------

  async function syncOrgs(
    orgs: NinjaOrg[]
  ): Promise<{ orgMap: Map<number, string>; clientsCreated: number }> {
    const orgMap = new Map<number, string>();
    let clientsCreated = 0;

    for (const org of orgs) {
      const ninjaOrgId = String(org.id);
      let dbClient = await prisma.client.findUnique({
        where: { ninjaOrgId },
        select: { id: true },
      });

      if (!dbClient) {
        dbClient = await prisma.client.create({
          data: {
            name: org.name,
            phone: org.phoneNumber ?? null,
            website: org.website ?? null,
            ninjaOrgId,
            isActive: true,
          },
          select: { id: true },
        });
        clientsCreated++;
        console.log(`[ninjarmm-sync] Created client: ${org.name}`);
      }

      orgMap.set(org.id, dbClient.id);
    }

    return { orgMap, clientsCreated };
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Device sync
  // ---------------------------------------------------------------------------

  async function syncDevices(
    devices: NinjaDevice[],
    orgMap: Map<number, string>
  ): Promise<{ devicesProcessed: number; assetsUpserted: number }> {
    let devicesProcessed = 0;
    let assetsUpserted = 0;

    for (const device of devices) {
      const clientId = orgMap.get(device.organizationId);
      if (!clientId) {
        console.warn(
          `[ninjarmm-sync] Skipping device ${device.id} — org ${device.organizationId} not mapped`
        );
        continue;
      }

      const ninjaDeviceId = String(device.id);
      const type = mapDeviceClass(device.nodeClass);
      const notes = device.os?.name ? `OS: ${device.os.name}` : null;

      await prisma.asset.upsert({
        where: { ninjaDeviceId },
        update: {
          name: device.systemName,
          hostname: device.dnsName ?? device.systemName,
          ipAddress: device.ipAddresses ?? null,
          macAddress: device.macAddresses ?? null,
          manufacturer: device.system?.manufacturer ?? null,
          model: device.system?.model ?? null,
          serialNumber: device.system?.serialNumber ?? null,
          type,
          clientId,
        },
        create: {
          name: device.systemName,
          hostname: device.dnsName ?? device.systemName,
          ipAddress: device.ipAddresses ?? null,
          macAddress: device.macAddresses ?? null,
          manufacturer: device.system?.manufacturer ?? null,
          model: device.system?.model ?? null,
          serialNumber: device.system?.serialNumber ?? null,
          type,
          status: "ACTIVE",
          clientId,
          ninjaDeviceId,
          ninjaSource: true,
          notes,
        },
      });

      devicesProcessed++;
      assetsUpserted++;
    }

    return { devicesProcessed, assetsUpserted };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Alert sync
  // ---------------------------------------------------------------------------

  async function syncAlerts(
    alerts: NinjaAlert[],
    orgMap: Map<number, string>
  ): Promise<{ alertsProcessed: number; ticketsCreated: number }> {
    let alertsProcessed = 0;
    let ticketsCreated = 0;

    const systemUser = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (!systemUser) {
      throw new Error(
        "No active ADMIN user found — cannot create tickets from alerts"
      );
    }

    for (const alert of alerts) {
      alertsProcessed++;

      const existing = await prisma.ticket.findUnique({
        where: { ninjaAlertId: alert.uid },
        select: { id: true },
      });
      if (existing) continue;

      const clientId = alert.organizationId
        ? orgMap.get(alert.organizationId)
        : undefined;
      if (!clientId) {
        console.warn(
          `[ninjarmm-sync] Skipping alert ${alert.uid} — org ${alert.organizationId} not mapped`
        );
        continue;
      }

      let relatedAssetId: string | undefined;
      if (alert.deviceId) {
        const asset = await prisma.asset.findUnique({
          where: { ninjaDeviceId: String(alert.deviceId) },
          select: { id: true },
        });
        relatedAssetId = asset?.id;
      }

      await prisma.ticket.create({
        data: {
          subject: `[NinjaOne] ${alert.message}`,
          description: `Automated alert from NinjaOne RMM.\n\nSeverity: ${alert.severity}\nMessage: ${alert.message}`,
          status: "OPEN",
          priority: alert.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
          source: "API",
          clientId,
          createdById: systemUser.id,
          ninjaAlertId: alert.uid,
          ...(relatedAssetId
            ? { relatedAssets: { connect: { id: relatedAssetId } } }
            : {}),
        },
      });

      ticketsCreated++;
      console.log(
        `[ninjarmm-sync] Ticket created for alert: ${alert.message}`
      );
    }

    return { alertsProcessed, ticketsCreated };
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  export async function runNinjaRmmSync(): Promise<SyncResult> {
    const startedAt = new Date();
    const errors: string[] = [];
    let orgsProcessed = 0,
      clientsCreated = 0,
      devicesProcessed = 0,
      assetsUpserted = 0,
      alertsProcessed = 0,
      ticketsCreated = 0;

    console.log("[ninjarmm-sync] Starting sync");

    try {
      const config = await loadNinjaRmmConfig();
      if (!config) throw new Error("NinjaOne RMM is not configured");

      const client = new NinjaRmmClient({
        instanceUrl: config.instanceUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });

      const [orgs, devices, alerts] = await Promise.all([
        client.getOrganizations(),
        client.getDevices(),
        client.getAlerts(),
      ]);

      const orgResult = await syncOrgs(orgs);
      orgsProcessed = orgResult.orgMap.size;
      clientsCreated = orgResult.clientsCreated;

      const deviceResult = await syncDevices(devices, orgResult.orgMap);
      devicesProcessed = deviceResult.devicesProcessed;
      assetsUpserted = deviceResult.assetsUpserted;

      const alertResult = await syncAlerts(alerts, orgResult.orgMap);
      alertsProcessed = alertResult.alertsProcessed;
      ticketsCreated = alertResult.ticketsCreated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(msg);
      console.error("[ninjarmm-sync] Error:", err);
    }

    const completedAt = new Date();

    if (errors.length === 0) {
      await prisma.settings.upsert({
        where: { key: LAST_SYNC_KEY },
        update: { value: completedAt.toISOString() },
        create: { key: LAST_SYNC_KEY, value: completedAt.toISOString() },
      });
    }

    const result: SyncResult = {
      success: errors.length === 0,
      orgsProcessed,
      clientsCreated,
      devicesProcessed,
      assetsUpserted,
      alertsProcessed,
      ticketsCreated,
      errors,
      startedAt,
      completedAt,
    };

    console.log("[ninjarmm-sync] Complete.", {
      orgsProcessed,
      clientsCreated,
      devicesProcessed,
      assetsUpserted,
      alertsProcessed,
      ticketsCreated,
      errors: errors.length,
      duration: `${completedAt.getTime() - startedAt.getTime()}ms`,
    });

    return result;
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep ninjarmm-sync
  ```

  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/ninjarmm/ninjarmm-sync.ts
  git commit -m "feat: add NinjaOne RMM 3-phase sync job (orgs, devices, alerts)"
  ```

---

## Task 4: CLI entry point + npm script

**Files:**
- Create: `src/lib/jobs/ninjarmm-sync-job.ts`
- Modify: `package.json`

- [ ] **Step 1: Create CLI entry file**

  Create `src/lib/jobs/ninjarmm-sync-job.ts`:

  ```typescript
  import { runNinjaRmmSync } from "@/lib/ninjarmm/ninjarmm-sync";

  const isDirectExecution =
    typeof require !== "undefined" && require.main === module;

  if (isDirectExecution) {
    runNinjaRmmSync()
      .then((result) => {
        if (!result.success) {
          console.error("[ninjarmm-sync] Completed with errors:", result.errors);
          process.exit(1);
        }
        console.log("[ninjarmm-sync] Completed successfully.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[ninjarmm-sync] Fatal error:", err);
        process.exit(1);
      });
  }
  ```

- [ ] **Step 2: Add npm script to `package.json`**

  In `package.json`, in the `"scripts"` block, add after `"email:sync"`:

  ```json
  "ninjarmm:sync": "tsx src/lib/jobs/ninjarmm-sync-job.ts"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/jobs/ninjarmm-sync-job.ts package.json
  git commit -m "feat: add NinjaOne RMM CLI sync script"
  ```

---

## Task 5: API routes

**Files:**
- Create: `src/app/api/integrations/ninjarmm/route.ts`
- Create: `src/app/api/integrations/ninjarmm/test/route.ts`
- Create: `src/app/api/integrations/ninjarmm/sync/route.ts`

- [ ] **Step 1: Create settings GET/POST route**

  Create `src/app/api/integrations/ninjarmm/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";
  import prisma from "@/lib/prisma";
  import {
    SETTINGS_KEY,
    LAST_SYNC_KEY,
    NinjaRmmConfig,
  } from "@/lib/ninjarmm/ninjarmm-sync";

  function requireAdmin(role: string | undefined) {
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return null;
  }

  export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const denied = requireAdmin((session.user as any).role);
    if (denied) return denied;

    const [configRow, lastSyncRow] = await Promise.all([
      prisma.settings.findUnique({ where: { key: SETTINGS_KEY } }),
      prisma.settings.findUnique({ where: { key: LAST_SYNC_KEY } }),
    ]);

    if (!configRow) {
      return NextResponse.json({
        configured: false,
        enabled: false,
        instanceUrl: "eu.ninjarmm.com",
        clientId: "",
        clientSecret: "",
        lastSyncedAt: null,
      });
    }

    const config = JSON.parse(configRow.value) as NinjaRmmConfig;

    return NextResponse.json({
      configured: true,
      enabled: config.enabled,
      instanceUrl: config.instanceUrl,
      clientId: config.clientId
        ? config.clientId.slice(0, 4) + "••••" + config.clientId.slice(-4)
        : "",
      clientSecret: config.clientSecret ? "••••••••" : "",
      lastSyncedAt: lastSyncRow?.value ?? null,
    });
  }

  export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const denied = requireAdmin((session.user as any).role);
    if (denied) return denied;

    const body = await request.json() as Partial<NinjaRmmConfig>;
    const { clientId, clientSecret, instanceUrl, enabled } = body;

    if (!clientId || !clientSecret || !instanceUrl) {
      return NextResponse.json(
        { error: "clientId, clientSecret, and instanceUrl are required" },
        { status: 400 }
      );
    }

    const config: NinjaRmmConfig = {
      clientId,
      clientSecret,
      instanceUrl,
      enabled: enabled ?? false,
    };

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(config) },
    });

    return NextResponse.json({ success: true });
  }
  ```

- [ ] **Step 2: Create test connection route**

  Create `src/app/api/integrations/ninjarmm/test/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";
  import { NinjaRmmClient } from "@/lib/ninjarmm/ninjarmm-client";

  export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    try {
      const body = await request.json() as {
        clientId: string;
        clientSecret: string;
        instanceUrl: string;
      };
      const { clientId, clientSecret, instanceUrl } = body;

      if (!clientId || !clientSecret || !instanceUrl) {
        return NextResponse.json(
          { success: false, error: "clientId, clientSecret, and instanceUrl are required" },
          { status: 400 }
        );
      }

      const client = new NinjaRmmClient({ clientId, clientSecret, instanceUrl });
      await client.testConnection();

      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      return NextResponse.json({ success: false, error: message });
    }
  }
  ```

- [ ] **Step 3: Create manual sync trigger route**

  Create `src/app/api/integrations/ninjarmm/sync/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";
  import { runNinjaRmmSync } from "@/lib/ninjarmm/ninjarmm-sync";

  export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    try {
      const result = await runNinjaRmmSync();
      return NextResponse.json({
        success: result.success,
        data: {
          orgsProcessed: result.orgsProcessed,
          clientsCreated: result.clientsCreated,
          devicesProcessed: result.devicesProcessed,
          assetsUpserted: result.assetsUpserted,
          alertsProcessed: result.alertsProcessed,
          ticketsCreated: result.ticketsCreated,
          errors: result.errors,
          durationMs:
            result.completedAt.getTime() - result.startedAt.getTime(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 4: Type-check all three routes**

  ```bash
  npx tsc --noEmit 2>&1 | grep "integrations/ninjarmm"
  ```

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/integrations/
  git commit -m "feat: add NinjaOne RMM API routes (settings, test, sync)"
  ```

---

## Task 6: Instrumentation — scheduled sync

**Files:**
- Create: `src/instrumentation.ts`

- [ ] **Step 1: Create the instrumentation file**

  Create `src/instrumentation.ts`:

  ```typescript
  export async function register() {
    // Only run in Node.js runtime (not Edge), and only in production or dev server.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

    async function runScheduledSync() {
      try {
        const { loadNinjaRmmConfig, runNinjaRmmSync } = await import(
          "@/lib/ninjarmm/ninjarmm-sync"
        );
        const config = await loadNinjaRmmConfig();
        if (!config?.enabled) return;
        await runNinjaRmmSync();
      } catch (err) {
        console.error("[ninjarmm-sync] Scheduled run error:", err);
      }
    }

    // First run 30 s after startup (gives DB time to be ready)
    setTimeout(runScheduledSync, 30_000);
    // Then every 15 minutes
    setInterval(runScheduledSync, INTERVAL_MS);

    console.log(
      "[ninjarmm-sync] Scheduled sync registered (every 15 minutes)"
    );
  }
  ```

- [ ] **Step 2: Enable instrumentation in next.config.js**

  Replace the contents of `next.config.js` with:

  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: "standalone",
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    experimental: {
      instrumentationHook: true,
    },
  };

  module.exports = nextConfig;
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep instrumentation
  ```

  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/instrumentation.ts next.config.js
  git commit -m "feat: register NinjaOne RMM 15-minute scheduled sync via instrumentation hook"
  ```

---

## Task 7: Admin UI — NinjaOne RMM tab in Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

This task adds state, handlers, and a new tab to the existing settings page. The file is large — work carefully and follow the existing patterns exactly.

- [ ] **Step 1: Add NinjaOne icon import**

  In `src/app/(dashboard)/settings/page.tsx`, in the lucide-react import block, add `Server` to the existing import list:

  ```typescript
  import {
    Mail,
    Shield,
    Users,
    Tags,
    Check,
    X,
    Clock,
    Sparkles,
    Plus,
    Building2,
    Upload,
    Trash2,
    RefreshCw,
    Eye,
    EyeOff,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Loader2,
    ExternalLink,
    Server,        // ← add this
  } from "lucide-react";
  ```

- [ ] **Step 2: Add NinjaOne state variables**

  In the main `SettingsPage` component, after the email-related state variables (search for `emailForm` state), add:

  ```typescript
  // NinjaOne RMM
  const [ninjaForm, setNinjaForm] = useState({
    clientId: "",
    clientSecret: "",
    instanceUrl: "eu.ninjarmm.com",
    enabled: false,
  });
  const [ninjaConfigured, setNinjaConfigured] = useState(false);
  const [ninjaLastSync, setNinjaLastSync] = useState<string | null>(null);
  const [ninjaTesting, setNinjaTesting] = useState(false);
  const [ninjaTestResult, setNinjaTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [ninjaSaving, setNinjaSaving] = useState(false);
  const [ninjaSyncing, setNinjaSyncing] = useState(false);
  const [ninjaSyncResult, setNinjaSyncResult] = useState<{
    success: boolean;
    data?: {
      clientsCreated: number;
      assetsUpserted: number;
      ticketsCreated: number;
      errors: string[];
    };
  } | null>(null);
  const [ninjaShowSecret, setNinjaShowSecret] = useState(false);
  ```

- [ ] **Step 3: Add NinjaOne data fetch inside the existing `useEffect`**

  Find the `useEffect` that loads settings data (it fetches email config, categories, etc.). Add a NinjaOne fetch inside the same effect:

  ```typescript
  // NinjaOne config
  fetch("/api/integrations/ninjarmm")
    .then((r) => r.json())
    .then((data) => {
      if (data.configured) {
        setNinjaConfigured(true);
        setNinjaForm((prev) => ({
          ...prev,
          clientId: data.clientId || "",
          instanceUrl: data.instanceUrl || "eu.ninjarmm.com",
          enabled: data.enabled,
        }));
        setNinjaLastSync(data.lastSyncedAt);
      }
    })
    .catch(() => {});
  ```

- [ ] **Step 4: Add NinjaOne handler functions**

  After the email handler functions (e.g. after `handleSaveEmail`), add:

  ```typescript
  async function handleTestNinja() {
    setNinjaTesting(true);
    setNinjaTestResult(null);
    try {
      const res = await fetch("/api/integrations/ninjarmm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: ninjaForm.clientId,
          clientSecret: ninjaForm.clientSecret,
          instanceUrl: ninjaForm.instanceUrl,
        }),
      });
      const data = await res.json();
      setNinjaTestResult({
        success: data.success,
        message: data.success ? "Connection successful" : data.error || "Connection failed",
      });
    } catch {
      setNinjaTestResult({ success: false, message: "Network error" });
    } finally {
      setNinjaTesting(false);
    }
  }

  async function handleSaveNinja() {
    setNinjaSaving(true);
    try {
      const res = await fetch("/api/integrations/ninjarmm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ninjaForm),
      });
      if (!res.ok) throw new Error("Save failed");
      setNinjaConfigured(true);
    } catch {
      // swallow — user sees no feedback; a toast could be added here
    } finally {
      setNinjaSaving(false);
    }
  }

  async function handleSyncNow() {
    setNinjaSyncing(true);
    setNinjaSyncResult(null);
    try {
      const res = await fetch("/api/integrations/ninjarmm/sync", {
        method: "POST",
      });
      const data = await res.json();
      setNinjaSyncResult(data);
      if (data.success) {
        setNinjaLastSync(new Date().toISOString());
      }
    } catch {
      setNinjaSyncResult({ success: false });
    } finally {
      setNinjaSyncing(false);
    }
  }
  ```

- [ ] **Step 5: Add the tab trigger**

  Find the line with `<TabsTrigger value="email"` and after its closing `</TabsTrigger>`, add:

  ```tsx
  <TabsTrigger value="ninjarmm" className="gap-2">
    <Server className="h-4 w-4" />
    NinjaOne RMM
  </TabsTrigger>
  ```

- [ ] **Step 6: Add the tab content**

  Find the closing `</TabsContent>` of the email tab (just before `</Tabs>`), and after it add:

  ```tsx
  <TabsContent value="ninjarmm">
    <div className="space-y-6">
      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            NinjaOne RMM
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sync devices and organisations from NinjaOne. Alerts with
            MAJOR or CRITICAL severity will automatically create tickets.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ninja-instance">Instance URL</Label>
              <Input
                id="ninja-instance"
                value={ninjaForm.instanceUrl}
                onChange={(e) =>
                  setNinjaForm((f) => ({ ...f, instanceUrl: e.target.value }))
                }
                placeholder="eu.ninjarmm.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ninja-client-id">Client ID</Label>
              <Input
                id="ninja-client-id"
                value={ninjaForm.clientId}
                onChange={(e) =>
                  setNinjaForm((f) => ({ ...f, clientId: e.target.value }))
                }
                placeholder="OAuth client ID"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ninja-secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="ninja-secret"
                type={ninjaShowSecret ? "text" : "password"}
                value={ninjaForm.clientSecret}
                onChange={(e) =>
                  setNinjaForm((f) => ({ ...f, clientSecret: e.target.value }))
                }
                placeholder="OAuth client secret"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setNinjaShowSecret((s) => !s)}
              >
                {ninjaShowSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Test result */}
          {ninjaTestResult && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                ninjaTestResult.success
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {ninjaTestResult.success ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <X className="h-4 w-4 shrink-0" />
              )}
              {ninjaTestResult.message}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleTestNinja}
              disabled={
                ninjaTesting ||
                !ninjaForm.clientId ||
                !ninjaForm.clientSecret ||
                !ninjaForm.instanceUrl
              }
            >
              {ninjaTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleSaveNinja}
              disabled={
                ninjaSaving ||
                !ninjaForm.clientId ||
                !ninjaForm.clientSecret ||
                !ninjaForm.instanceUrl
              }
            >
              {ninjaSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enable + Sync */}
      {ninjaConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable scheduled sync</p>
                <p className="text-xs text-muted-foreground">
                  Runs every 15 minutes when the server is running
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ninjaForm.enabled}
                onClick={() => {
                  setNinjaForm((f) => ({ ...f, enabled: !f.enabled }));
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ninjaForm.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ninjaForm.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 text-sm text-muted-foreground">
                {ninjaLastSync ? (
                  <>
                    Last sync:{" "}
                    {new Date(ninjaLastSync).toLocaleString()}
                  </>
                ) : (
                  "Never synced"
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={ninjaSyncing}
              >
                {ninjaSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Now
              </Button>
            </div>

            {/* Sync result */}
            {ninjaSyncResult && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  ninjaSyncResult.success
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {ninjaSyncResult.success && ninjaSyncResult.data ? (
                  <ul className="space-y-1">
                    <li>Clients created: {ninjaSyncResult.data.clientsCreated}</li>
                    <li>Assets synced: {ninjaSyncResult.data.assetsUpserted}</li>
                    <li>Tickets created: {ninjaSyncResult.data.ticketsCreated}</li>
                  </ul>
                ) : (
                  <span>
                    Sync failed.{" "}
                    {ninjaSyncResult.data?.errors?.join(", ")}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  </TabsContent>
  ```

- [ ] **Step 7: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep settings
  ```

  Expected: no errors for settings/page.tsx.

- [ ] **Step 8: Commit**

  ```bash
  git add "src/app/(dashboard)/settings/page.tsx"
  git commit -m "feat: add NinjaOne RMM tab to Settings page"
  ```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Build the Docker image**

  ```bash
  docker compose build app
  ```

  Expected: build completes with no TypeScript or module errors.

- [ ] **Step 2: Restart the container**

  ```bash
  docker compose up -d app
  docker compose logs -f app --tail=50
  ```

  Expected: `[ninjarmm-sync] Scheduled sync registered (every 15 minutes)` in logs.

- [ ] **Step 3: Verify Settings page loads the NinjaOne tab**

  Open the app in a browser, navigate to Settings, confirm "NinjaOne RMM" tab is visible and clickable.

- [ ] **Step 4: Test the test-connection endpoint with curl**

  ```bash
  # Replace <SESSION_COOKIE> with a valid admin session token
  curl -X POST https://<your-domain>/api/integrations/ninjarmm/test \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=<SESSION_COOKIE>" \
    -d '{"clientId":"test","clientSecret":"bad","instanceUrl":"eu.ninjarmm.com"}'
  ```

  Expected: `{"success":false,"error":"NinjaOne OAuth failed (400): ..."}` (not a 500).

- [ ] **Step 5: Confirm new DB columns exist**

  ```bash
  docker compose exec db psql -U mspdesk -d msp_service_desk \
    -c "\d clients" | grep ninja
  docker compose exec db psql -U mspdesk -d msp_service_desk \
    -c "\d assets" | grep ninja
  docker compose exec db psql -U mspdesk -d msp_service_desk \
    -c "\d tickets" | grep ninja
  ```

  Expected: `ninjaOrgId`, `ninjaDeviceId`, `ninjaSource`, `ninjaAlertId` columns present.

- [ ] **Step 6: Final commit tag**

  ```bash
  git log --oneline -8
  ```

  Confirm all 6 feature commits are in the log.
