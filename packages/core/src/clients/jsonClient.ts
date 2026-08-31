import { SERVER_KEY } from "../constants";
import { AuthMode, McpClient, RegisterOptions } from "../types";
import { exists, readTextIfPresent, writePrivate } from "../fsutil";

export interface JsonClientSpec {
  id: string;
  name: string;
  supportsOAuth: boolean;
  /** Absolute path of the MCP config file this client reads. */
  configPath: string;
  /** Paths whose existence indicates the client is installed. */
  detectPaths: string[];
  /** Top-level key holding the server map, e.g. "mcpServers". */
  rootKey: string;
  /** Build this client's server entry for the given auth mode. */
  buildEntry(auth: AuthMode): Record<string, unknown>;
}

/**
 * Most AI clients read a JSON file with a `{ [rootKey]: { [name]: entry } }`
 * shape and differ only in path and entry fields. This factory covers them;
 * merge is read–modify–write so entries for other servers are preserved.
 */
export function jsonClient(spec: JsonClientSpec): McpClient {
  async function readConfig(): Promise<Record<string, any>> {
    const raw = await readTextIfPresent(spec.configPath);
    if (raw === undefined || raw.trim() === "") return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `${spec.name} config at ${spec.configPath} is not valid JSON — fix or remove it, then retry (${String(err)})`
      );
    }
  }

  return {
    id: spec.id,
    name: spec.name,
    supportsOAuth: spec.supportsOAuth,
    describeTarget: () => spec.configPath,

    async detect() {
      for (const p of spec.detectPaths) {
        if (await exists(p)) return true;
      }
      return false;
    },

    async isRegistered() {
      try {
        const cfg = await readConfig();
        return Boolean(cfg[spec.rootKey]?.[SERVER_KEY]);
      } catch {
        return false;
      }
    },

    async register(opts: RegisterOptions) {
      const cfg = await readConfig();
      cfg[spec.rootKey] = cfg[spec.rootKey] ?? {};
      cfg[spec.rootKey][SERVER_KEY] = spec.buildEntry(opts.auth);
      await writePrivate(spec.configPath, JSON.stringify(cfg, null, 2) + "\n");
    },

    async unregister() {
      const raw = await readTextIfPresent(spec.configPath);
      if (raw === undefined) return;
      const cfg = await readConfig();
      if (cfg[spec.rootKey]?.[SERVER_KEY]) {
        delete cfg[spec.rootKey][SERVER_KEY];
        await writePrivate(spec.configPath, JSON.stringify(cfg, null, 2) + "\n");
      }
    },
  };
}
