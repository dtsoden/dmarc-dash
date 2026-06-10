import { ConfidentialClientApplication } from "@azure/msal-node";

interface AuthCfg { tenantId: string; clientId: string; clientSecret: string; }
interface CcaLike { acquireTokenByClientCredential(req: { scopes: string[] }): Promise<{ accessToken: string; expiresOn?: Date | null } | null>; }

export class GraphAuth {
  private token: string | null = null;
  private expiresAt = 0;
  constructor(private cfg: AuthCfg, private cca?: CcaLike) {
    if (!this.cca) {
      this.cca = new ConfidentialClientApplication({
        auth: { clientId: cfg.clientId, authority: `https://login.microsoftonline.com/${cfg.tenantId}`, clientSecret: cfg.clientSecret },
      });
    }
  }
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.expiresAt - 60_000) return this.token;
    const res = await this.cca!.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
    if (!res?.accessToken) throw new Error("Failed to acquire Graph token");
    this.token = res.accessToken;
    this.expiresAt = res.expiresOn ? res.expiresOn.getTime() : now + 3000_000;
    return this.token;
  }
}
