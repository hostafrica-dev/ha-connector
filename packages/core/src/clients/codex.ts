import * as os from "node:os";
import * as path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { SERVER_KEY } from "../constants";
import { McpClient, RegisterOptions, endpointFor } from "../types";
import { exists, readTextIfPresent, writePrivate } from "../fsutil";

/**
 * OpenAI Codex CLI reads TOML at ~/.codex/config.toml with an `mcp_servers`
 * table. Streamable-HTTP servers use `url` (no experimental flag needed since
 * ~v0.44). OAuth is supported per the MCP authorization spec — `auth` defaults
 * to "oauth" and `codex mcp login <name>` runs the browser flow — so a bare
 * `url` entry is the OAuth-first registration. Token fallback writes
 * `http_headers`; `bearer_token_env_var` is the secretless alternative when
 * the user prefers env vars.
 */
export function makeCodex(home: string = os.homedir()): McpClient {
  const configPath = path.join(home, ".codex", "config.toml");

  async function readConfig(): Promise<Record<string, any>> {
    const raw = await readTextIfPresent(configPath);
    if (raw === undefined || raw.trim() === "") return {};
    try {
      return parseToml(raw) as Record<string, any>;
    } catch (err) {
      throw new Error(
        `Codex config at ${configPath} is not valid TOML — fix or remove it, then retry (${String(err)})`
      );
    }
  }

  return {
    id: "codex",
    name: "OpenAI Codex CLI",
    supportsOAuth: true, // `codex mcp login` — DCR and CIMD both supported
    describeTarget: () => configPath,

    async detect() {
      return exists(path.join(home, ".codex"));
    },

    async isRegistered() {
      try {
        const cfg = await readConfig();
        return Boolean(cfg["mcp_servers"]?.[SERVER_KEY]);
      } catch {
        return false;
      }
    },

    async register(opts: RegisterOptions) {
      const cfg = await readConfig();
      const { url, headers } = endpointFor(opts.auth);
      const entry: Record<string, unknown> = { url };
      if (headers) entry["http_headers"] = headers;
      cfg["mcp_servers"] = cfg["mcp_servers"] ?? {};
      cfg["mcp_servers"][SERVER_KEY] = entry;
      await writePrivate(configPath, stringifyToml(cfg) + "\n");
    },

    async unregister() {
      const raw = await readTextIfPresent(configPath);
      if (raw === undefined) return;
      const cfg = await readConfig();
      if (cfg["mcp_servers"]?.[SERVER_KEY]) {
        delete cfg["mcp_servers"][SERVER_KEY];
        await writePrivate(configPath, stringifyToml(cfg) + "\n");
      }
    },
  };
}

export const codex: McpClient = makeCodex();
