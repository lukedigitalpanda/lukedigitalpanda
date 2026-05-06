# NinjaOne RMM Integration Design

**Date:** 2026-05-06  
**Status:** Approved

## Overview

Integrate NinjaOne RMM with the MSP service desk to automatically sync managed devices into Assets and create tickets from critical/major alerts. NinjaOne is the source of truth for organizations (clients) and devices.

---

## Goals

- Pull all NinjaOne organizations into the Clients table (create if missing)
- Sync all managed devices into the Assets table
- Auto-create tickets for MAJOR and CRITICAL severity alerts
- Admin UI to configure credentials, toggle the integration, and trigger manual syncs
- Scheduled polling every 15 minutes

## Non-Goals

- Bidirectional sync (tickets do not push back to NinjaOne)
- Webhook-based real-time updates
- Syncing alert history (only currently active alerts)

---

## Architecture

### Approach

Background job pattern mirroring the existing `email-sync.ts`. A `node-cron` job runs inside the Next.js process every 15 minutes, checks if the integration is enabled, and runs the three-phase sync.

### Instance

Default instance: `eu.ninjarmm.com`

---

## Data Model Changes

### `Client` model
```prisma
ninjaOrgId String? @unique
```
Links a client to a NinjaOne organization. Null for manually-created clients that haven't been linked.

### `Asset` model
```prisma
ninjaDeviceId String? @unique
ninjaSource   Boolean @default(false)
```
- `ninjaDeviceId`: NinjaOne device ID, used for upsert deduplication
- `ninjaSource`: marks assets that originated from NinjaOne (as opposed to manually created)

### `Ticket` model
```prisma
ninjaAlertId String? @unique
```
Prevents duplicate tickets from the same active alert across sync runs.

### `Settings` keys
| Key | Description |
|-----|-------------|
| `ninjarmm.clientId` | OAuth client ID |
| `ninjarmm.clientSecret` | OAuth client secret |
| `ninjarmm.instanceUrl` | Base URL (default: `eu.ninjarmm.com`) |
| `ninjarmm.enabled` | `"true"` / `"false"` |
| `ninjarmm.lastSyncedAt` | ISO timestamp of last successful sync |

---

## New Files

### `src/lib/ninjarmm/ninjarmm-client.ts`

NinjaOne REST API client.

**Auth:** OAuth 2.0 Client Credentials flow. Posts to `https://{instanceUrl}/oauth/token` with `client_id`, `client_secret`, and `grant_type=client_credentials`. Token is cached in memory and refreshed automatically when expired (~1 hour TTL).

**Methods:**
- `getOrganizations()` → `GET /v2/organizations`
- `getDevices()` → `GET /v2/devices-detailed`
- `getAlerts()` → `GET /v2/alerts` (filtered to severity `MAJOR`, `CRITICAL`)

### `src/lib/ninjarmm/ninjarmm-sync.ts`

Three-phase sync job.

**Phase 1 — Org sync:**
1. Fetch all NinjaOne organizations
2. For each org, upsert `Client` by `ninjaOrgId`
3. If no matching client exists, create one using the org name, website, and phone
4. Manually-created clients without a `ninjaOrgId` are untouched

**Phase 2 — Device sync:**
1. Fetch all devices from NinjaOne
2. Resolve the client via `ninjaOrgId` → `clientId` mapping built in Phase 1
3. Upsert `Asset` by `ninjaDeviceId`
4. Map NinjaOne device class to `AssetType`:

| NinjaOne class | AssetType |
|---|---|
| `WINDOWS_WORKSTATION`, `MAC` | `WORKSTATION` |
| `WINDOWS_LAPTOP`, `MAC_LAPTOP` | `LAPTOP` |
| `WINDOWS_SERVER`, `LINUX_SERVER` | `SERVER` |
| `NMS_SWITCH`, `NMS_ROUTER`, `NMS_FIREWALL` | `NETWORK_DEVICE` |
| `MOBILE_DEVICE` | `MOBILE_DEVICE` |
| everything else | `OTHER` |

Fields synced: `name`, `hostname`, `ipAddress`, `macAddress`, `manufacturer`, `model`, `serialNumber`. OS info stored in `notes`.

**Phase 3 — Alert sync:**
1. Fetch active alerts with severity `MAJOR` or `CRITICAL`
2. Skip any alert where a `Ticket` with that `ninjaAlertId` already exists
3. For new alerts, create a `Ticket`:
   - `subject`: `[NinjaOne] {alert message}`
   - `source`: `API`
   - `priority`: `MAJOR` → `HIGH`, `CRITICAL` → `CRITICAL`
   - `clientId`: resolved via device → org mapping
   - `relatedAssets`: linked via `ninjaDeviceId`
   - `ninjaAlertId`: stored to prevent future duplicates

### `src/lib/jobs/ninjarmm-sync-job.ts`

Cron scheduler. Registers a `node-cron` job at `*/15 * * * *`.

Before each run:
1. Reads `ninjarmm.enabled` from Settings — skips if `"false"`
2. Calls `runNinjaRmmSync()`
3. Logs result (counts of orgs/devices/alerts synced, any errors)

Registered at app startup alongside the existing email sync job.

### `src/app/api/integrations/ninjarmm/route.ts`

**`GET`** — Returns current settings (client ID masked, enabled status, lastSyncedAt, instance URL).

**`POST`** — Saves credentials and settings to the `Settings` table.

### `src/app/api/integrations/ninjarmm/test/route.ts`

**`POST`** — Attempts OAuth token fetch using provided credentials. Returns `{ success: true }` or `{ success: false, error: string }`. Used by the admin UI test button.

### `src/app/api/integrations/ninjarmm/sync/route.ts`

**`POST`** — Triggers an immediate sync run. Returns counts of records synced. Admin-only.

---

## Admin UI

**Route:** `/settings/integrations/ninjarmm`  
**Access:** Admin role only

**Sections:**
1. **Credentials** — Client ID, Client Secret (masked), Instance URL (default `eu.ninjarmm.com`)
2. **Test Connection** button — calls `/test` endpoint, shows pass/fail inline
3. **Enable toggle** — enables/disables the scheduled sync
4. **Sync status** — shows last sync time and a "Sync Now" button
5. **Stats** — after sync, shows counts of clients/assets/tickets created or updated

---

## Sync Behaviour Notes

- Devices whose org doesn't match any client (e.g. org sync failed) are skipped with a warning log
- Resolved NinjaOne alerts do NOT automatically close tickets — a technician closes them
- Assets synced from NinjaOne can be manually edited; the next sync only updates NinjaOne-sourced fields (hostname, IP, etc.), not manually added fields like `notes` or `warrantyEnd`
- `node-cron` is already a transitive dependency of common Next.js setups; if not present, add it explicitly

---

## File Summary

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add `ninjaOrgId`, `ninjaDeviceId`, `ninjaSource`, `ninjaAlertId` |
| `src/lib/ninjarmm/ninjarmm-client.ts` | OAuth + API fetch methods |
| `src/lib/ninjarmm/ninjarmm-sync.ts` | 3-phase sync logic |
| `src/lib/jobs/ninjarmm-sync-job.ts` | node-cron scheduler |
| `src/app/api/integrations/ninjarmm/route.ts` | GET/POST settings |
| `src/app/api/integrations/ninjarmm/test/route.ts` | POST test connection |
| `src/app/api/integrations/ninjarmm/sync/route.ts` | POST manual sync trigger |
| `src/app/(dashboard)/settings/integrations/ninjarmm/page.tsx` | Admin UI |
