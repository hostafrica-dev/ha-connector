import * as os from "node:os";
import * as path from "node:path";
import { MCP_BEARER_URL, MCP_OAUTH_URL } from "../constants";
import { ClientStatus, McpClient, endpointFor } from "../types";
import { jsonClient } from "./jsonClient";
import { claudeCode } from "./claudeCode";
import { makeCodex } from "./codex";

/** Per-OS location of Claude Desktop's config file. */
export function claudeDesktopConfigPath(home: string): string {
  if (process.platform === "win32") {
    return path.join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  return path.join(home, ".config", "Claude", "claude_desktop_config.json");
}

/**
 * Build the client set rooted at a given home directory. Production callers
 * use the real home (the default); tests pass a temp dir.
 */
export function createClients(home: string = os.homedir()): McpClient[] {
  /** Cursor: supports remote HTTP MCP + the MCP authorization spec. */
  const cursor = jsonClient({
    id: "cursor",
    name: "Cursor",
    supportsOAuth: true,
    configPath: path.join(home, ".cursor", "mcp.json"),
    detectPaths: [path.join(home, ".cursor")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { url, headers } : { url };
    },
  });

  /**
   * Windsurf (now Cognition/Devin Desktop): HTTP servers use `serverUrl`
   * (also accepts `url`; serverUrl is the long-supported key). OAuth for
   * URL-only entries confirmed in docs.devin.ai/desktop/cascade/mcp.
   */
  const windsurf = jsonClient({
    id: "windsurf",
    name: "Windsurf",
    supportsOAuth: true,
    configPath: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
    detectPaths: [path.join(home, ".codeium", "windsurf")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { serverUrl: url, headers } : { serverUrl: url };
    },
  });

  /**
   * Google Antigravity: `serverUrl` (legacy `url`/`httpUrl` are rejected),
   * headers supported, OAuth automatic for DCR-capable servers.
   * Global config: ~/.gemini/config/mcp_config.json.
   */
  const antigravity = jsonClient({
    id: "antigravity",
    name: "Google Antigravity",
    supportsOAuth: true,
    configPath: path.join(home, ".gemini", "config", "mcp_config.json"),
    detectPaths: [
      path.join(home, ".gemini", "antigravity"),
      path.join(home, ".gemini", "config", "mcp_config.json"),
    ],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { serverUrl: url, headers } : { serverUrl: url };
    },
  });

  /**
   * Devin CLI / Devin for Terminal: ~/.config/devin/mcp_config.json,
   * `url` + optional `transport: "http"` + headers; OAuth via
   * `devin mcp login <name>` browser flow.
   */
  const devinCli = jsonClient({
    id: "devin-cli",
    name: "Devin CLI",
    supportsOAuth: true,
    configPath: path.join(home, ".config", "devin", "mcp_config.json"),
    detectPaths: [path.join(home, ".config", "devin")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers
        ? { url, transport: "http", headers }
        : { url, transport: "http" };
    },
  });

  /**
   * JetBrains Junie: user-level ~/.junie/mcp/mcp.json, `url` + headers,
   * OAuth browser flow on "Authorization required". (JetBrains AI Assistant
   * itself is UI-configured only — covered by docs, not the registrar.)
   */
  const junie = jsonClient({
    id: "junie",
    name: "JetBrains Junie",
    supportsOAuth: true,
    configPath: path.join(home, ".junie", "mcp", "mcp.json"),
    detectPaths: [path.join(home, ".junie")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { url, headers } : { url };
    },
  });

  /**
   * Claude Desktop: its config file only supports stdio servers, so bridge to
   * the remote endpoint with `mcp-remote` (npx). OAuth mode runs mcp-remote's
   * own browser flow against the OAuth endpoint; token mode passes the bearer
   * header via an env var (mcp-remote expands ${...} in --header, and this
   * avoids the arg-splitting some stdio clients do on spaces). Requires Node on
   * the user's machine — inherent to the bridge.
   */
  const claudeDesktop = jsonClient({
    id: "claude-desktop",
    name: "Claude Desktop",
    supportsOAuth: true,
    configPath: claudeDesktopConfigPath(home),
    detectPaths: [path.dirname(claudeDesktopConfigPath(home))],
    rootKey: "mcpServers",
    buildEntry(auth) {
      if (auth.kind === "oauth") {
        return { command: "npx", args: ["-y", "mcp-remote", MCP_OAUTH_URL] };
      }
      return {
        command: "npx",
        args: ["-y", "mcp-remote", MCP_BEARER_URL, "--header", "Authorization:${HOSTAFRICA_AUTH}"],
        env: { HOSTAFRICA_AUTH: `Bearer ${auth.token}` },
      };
    },
  });

  /** Gemini CLI: HTTP servers use `httpUrl` in ~/.gemini/settings.json. */
  const geminiCli = jsonClient({
    id: "gemini-cli",
    name: "Gemini CLI",
    supportsOAuth: true,
    configPath: path.join(home, ".gemini", "settings.json"),
    detectPaths: [path.join(home, ".gemini")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { httpUrl: url, headers } : { httpUrl: url };
    },
  });

  // claudeCode drives the `claude` CLI, which resolves its own home.
  return [
    claudeCode,
    cursor,
    windsurf,
    geminiCli,
    makeCodex(home),
    antigravity,
    devinCli,
    junie,
    claudeDesktop,
  ];
}

/**
 * All clients the registrar can configure directly. VS Code itself is not in
 * this list: the extension registers the server natively through the
 * McpServerDefinitionProvider API instead of writing config files.
 */
export function allClients(): McpClient[] {
  return createClients();
}

export function clientById(id: string): McpClient | undefined {
  return allClients().find((c) => c.id === id);
}

/** Installed/registered status for every known client. */
export async function clientStatuses(): Promise<ClientStatus[]> {
  return Promise.all(
    allClients().map(async (client) => {
      const installed = await client.detect();
      const registered = installed ? await client.isRegistered() : false;
      return { client, installed, registered };
    })
  );
}
