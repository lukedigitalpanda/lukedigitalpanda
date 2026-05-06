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
    const isNew = !(await prisma.client.findUnique({
      where: { ninjaOrgId },
      select: { id: true },
    }));

    const dbClient = await prisma.client.upsert({
      where: { ninjaOrgId },
      update: {},
      create: {
        name: org.name,
        phone: org.phoneNumber ?? null,
        website: org.website ?? null,
        ninjaOrgId,
        isActive: true,
      },
      select: { id: true },
    });

    if (isNew) {
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

    try {
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
    } catch (err) {
      console.error(`[ninjarmm-sync] Failed to upsert device ${device.id}:`, err);
    }
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
    try {
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
    } catch (err) {
      console.error(`[ninjarmm-sync] Failed to process alert ${alert.uid}:`, err);
    }
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

    if (!config.enabled) {
      console.log("[ninjarmm-sync] Sync is disabled — skipping");
      return {
        success: true,
        orgsProcessed: 0,
        clientsCreated: 0,
        devicesProcessed: 0,
        assetsUpserted: 0,
        alertsProcessed: 0,
        ticketsCreated: 0,
        errors: [],
        startedAt,
        completedAt: new Date(),
      };
    }

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
