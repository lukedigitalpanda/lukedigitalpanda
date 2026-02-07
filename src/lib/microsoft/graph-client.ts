import {
  ConfidentialClientApplication,
  Configuration,
  AuthenticationResult,
} from "@azure/msal-node";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPH_SCOPES = ["https://graph.microsoft.com/.default"];

function getMsalConfig(): Configuration {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const tenantId = process.env.MS_GRAPH_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      "Missing Microsoft Graph environment variables. " +
        "Ensure MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, and MS_GRAPH_TENANT_ID are set."
    );
  }

  return {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    // MSAL uses an in-memory token cache by default, which handles
    // caching and automatic refresh of tokens for us.
  };
}

// ---------------------------------------------------------------------------
// Singleton MSAL application instance
// ---------------------------------------------------------------------------

let msalInstance: ConfidentialClientApplication | null = null;

function getMsalInstance(): ConfidentialClientApplication {
  if (!msalInstance) {
    msalInstance = new ConfidentialClientApplication(getMsalConfig());
  }
  return msalInstance;
}

// ---------------------------------------------------------------------------
// Token acquisition
// ---------------------------------------------------------------------------

async function acquireToken(): Promise<string> {
  const client = getMsalInstance();

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
  /**
   * Execute an authenticated GET request against the Microsoft Graph API.
   */
  get<T = any>(url: string, params?: Record<string, string>): Promise<T>;

  /**
   * Execute an authenticated POST request against the Microsoft Graph API.
   */
  post<T = any>(url: string, body?: unknown): Promise<T>;

  /**
   * Execute an authenticated PATCH request against the Microsoft Graph API.
   */
  patch<T = any>(url: string, body?: unknown): Promise<T>;

  /**
   * Execute an authenticated DELETE request against the Microsoft Graph API.
   */
  delete(url: string): Promise<void>;
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const accessToken = await acquireToken();

  // Support both absolute Graph URLs (e.g. deltaLink) and relative paths.
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
  if (!params || Object.keys(params).length === 0) {
    return path;
  }
  const qs = new URLSearchParams(params).toString();
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${qs}`;
}

/**
 * Returns a lightweight, authenticated Microsoft Graph API client.
 *
 * The client uses the OAuth 2.0 client credentials flow via MSAL and
 * automatically caches / refreshes tokens.
 *
 * Usage:
 * ```ts
 * const graph = getGraphClient();
 * const messages = await graph.get("/users/support@contoso.com/messages");
 * ```
 */
export function getGraphClient(): GraphClient {
  return {
    async get<T = any>(
      url: string,
      params?: Record<string, string>
    ): Promise<T> {
      const response = await graphFetch("GET", buildUrl(url, params));
      return response.json() as Promise<T>;
    },

    async post<T = any>(url: string, body?: unknown): Promise<T> {
      const response = await graphFetch("POST", url, body);
      // Some POST endpoints (e.g. sendMail) return 202 with no body.
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
