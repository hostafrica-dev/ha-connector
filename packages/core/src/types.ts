import { MCP_BEARER_URL, MCP_OAUTH_URL } from "./constants";

export type AuthMode =
  | { kind: "oauth" }
  | { kind: "token"; token: string };

export interface Endpoint {
  url: string;
  headers?: Record<string, string>;
}

/** Resolve the endpoint + headers a given auth mode maps to. */
export function endpointFor(auth: AuthMode): Endpoint {
  if (auth.kind === "oauth") {
    return { url: MCP_OAUTH_URL };
  }
  return {
    url: MCP_BEARER_URL,
    headers: { Authorization: `Bearer ${auth.token}` },
  };
}

export interface RegisterOptions {
  auth: AuthMode;
}

export interface McpClient {
  /** Stable id, e.g. "cursor". */
  id: string;
  /** Display name, e.g. "Cursor". */
  name: string;
  /**
   * Whether this client currently implements the MCP authorization spec for
   * remote HTTP servers. Flip per client as support lands — the registrar
   * picks OAuth whenever this is true, token fallback otherwise.
   */
  supportsOAuth: boolean;
  /** Whether the client appears to be installed on this machine. */
  detect(): Promise<boolean>;
  /** Whether the HostAfrica server is currently registered with this client. */
  isRegistered(): Promise<boolean>;
  register(opts: RegisterOptions): Promise<void>;
  unregister(): Promise<void>;
  /** Where the registration lives (config path or command), for display. */
  describeTarget(): string;
}

export interface ClientStatus {
  client: McpClient;
  installed: boolean;
  registered: boolean;
}
