import {
  ConfidentialClientApplication,
  Configuration,
  AuthenticationResult,
} from "@azure/msal-node";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPH_SCOPES = ["https://graph.microsoft.com/.default"];

interface MsGraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

/** Load credentials from env vars, then DB fallback */
async function resolveCredentials(): Promise<MsGraphCredentials> {
  const envClientId = process.env.MS_GRAPH_CLIENT_ID;
  const envSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const envTenantId = process.env.MS_GRAPH_TENANT_ID;

  if (envClientId && envSecret && envTenantId) {
    return { clientId: envClientId, clientSecret: envSecret, tenantId: envTenantId };
  }

  // Fall back to database settings
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.settings.findUnique({ where: { key: "email_config" } });
    if (row) {
      const config = JSON.parse(row.value) as {
        clientId?: string;
        clientSecret?: string;
        tenantId?: string;
      };
      if (config.clientId && config.clientSecret && config.tenantId) {
        return {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tenantId: config.tenantId,
        };
      }
    }
  } catch {
    // DB not available
  }

  throw new Error(
    "Missing Microsoft Graph credentials. Configure via Settings > Email Integration or set " +
      "MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID environment variables."
  );
}

// ---------------------------------------------------------------------------
// Singleton MSAL application instance
// ---------------------------------------------------------------------------

let msalInstance: ConfidentialClientApplication | null = null;

/** Call this after updating credentials in the database to force re-init */
export function resetMsalInstance(): void {
  msalInstance = null;
}

async function getMsalInstance(): Promise<ConfidentialClientApplication> {
  if (!msalInstance) {
    const creds = await resolveCredentials();
    const config: Configuration = {
      auth: {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        authority: `https://login.microsoftonline.com/${creds.tenantId}`,
      },
    };
    msalInstance = new ConfidentialClientApplication(config);
  }
  return msalInstance;
}

// ---------------------------------------------------------------------------
// Token acquisition
// ---------------------------------------------------------------------------

async function acquireToken(): Promise<string> {
  const client = await getMsalInstance();

  const result: AuthenticationResult | null =
    await client.acquireTokenByClientCredential({
      scopes: GRAPH_SCOPES,
    });

  if (!result || !result.accessToken) {
    throw new Error(
      "Failed to acquire Microsoft Graph access token via client credentials flow."
    );
  }

  return result.accessToken;
}

// ---------------------------------------------------------------------------
// Graph client wrapper
// ---------------------------------------------------------------------------

export interface GraphClient {
  get<T = any>(url: string, params?: Record<string, string>): Promise<T>;
  post<T = any>(url: string, body?: unknown): Promise<T>;
  patch<T = any>(url: string, body?: unknown): Promise<T>;
  delete(url: string): Promise<void>;
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const accessToken = await acquireToken();

  const fullUrl = url.startsWith("https://") ? url : `${GRAPH_BASE}${url}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, init);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Graph API ${method} ${fullUrl} failed (${response.status}): ${errorBody}`
    );
  }

  return response;
}

function buildUrl(path: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return path;
  const qs = new URLSearchParams(params).toString();
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${qs}`;
}

export function getGraphClient(): GraphClient {
  return {
    async get<T = any>(url: string, params?: Record<string, string>): Promise<T> {
      const response = await graphFetch("GET", buildUrl(url, params));
      return response.json() as Promise<T>;
    },
    async post<T = any>(url: string, body?: unknown): Promise<T> {
      const response = await graphFetch("POST", url, body);
      const text = await response.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    },
    async patch<T = any>(url: string, body?: unknown): Promise<T> {
      const response = await graphFetch("PATCH", url, body);
      const text = await response.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    },
    async delete(url: string): Promise<void> {
      await graphFetch("DELETE", url);
    },
  };
}

/** Returns the mailbox address, checking env then DB */
export async function resolveMailbox(): Promise<string | null> {
  if (process.env.MS_GRAPH_MAILBOX) return process.env.MS_GRAPH_MAILBOX;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.settings.findUnique({ where: { key: "email_config" } });
    if (row) {
      const config = JSON.parse(row.value) as { mailbox?: string };
      return config.mailbox || null;
    }
  } catch {}
  return null;
}
