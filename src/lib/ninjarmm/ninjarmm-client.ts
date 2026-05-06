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
