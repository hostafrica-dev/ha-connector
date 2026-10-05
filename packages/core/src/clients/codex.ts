import * as os from "node:os";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { SERVER_KEY } from "../constants";
import { McpClient, RegisterOptions, endpointFor } from "../types";
import { exists, readTextIfPresent, writeConfigFile } from "../fsutil";

type Toml = Record<string, any>;

/** A table or array-of-tables header line, e.g. `[profiles.fast]`. */
const TABLE_HEADER = /^\s*\[\[?\s*[A-Za-z0-9_"'-][^\]]*\]\]?\s*(#.*)?$/;
/** Our table and its subtables: `[mcp_servers.hostafrica]`, `[mcp_servers.hostafrica.http_headers]`. */
const OUR_HEADER = new RegExp(
  String.raw`^\s*\[\s*mcp_servers\s*\.\s*(?:${SERVER_KEY}|"${SERVER_KEY}"|'${SERVER_KEY}')\s*(?:\.[^\]]*)?\]\s*(#.*)?$`
);

/**
 * Replace our tables in the TOML text with `block` (or drop them when
 * `block` is undefined), leaving every other line, comments included, as it
 * was. Comments and blank lines trailing our table are kept, since they
 * usually introduce the next one. A new block goes at the end of the file.
 */
function spliceServerTable(raw: string, block: string | undefined): string {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const blockLines = block === undefined ? [] : block.trimEnd().split("\n");
  const out: string[] = [];
  let inOurs = false;
  let placed = false;
  let trailing: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (TABLE_HEADER.test(line)) {
      if (OUR_HEADER.test(line)) {
        if (!placed) out.push(...blockLines);
        placed = true;
        inOurs = true;
        trailing = [];
        continue;
      }
      if (inOurs) out.push(...trailing);
      inOurs = false;
    }
    if (inOurs) {
      const t = line.trim();
      if (t === "" || t.startsWith("#")) trailing.push(line);
      else trailing = [];
      continue;
    }
    out.push(line);
  }
  if (inOurs) out.push(...trailing);
  if (!placed && blockLines.length > 0) {
    while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
    if (out.length > 0) out.push("");
    out.push(...blockLines);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.length > 0 ? out.join(eol) + eol : "";
}

/** The config with our server removed, normalised so absent and empty compare equal. */
function withoutOurs(cfg: Toml): Toml {
  const copy: Toml = { ...cfg };
  if (copy["mcp_servers"] !== undefined) {
    const servers = { ...copy["mcp_servers"] };
    delete servers[SERVER_KEY];
    if (Object.keys(servers).length === 0) delete copy["mcp_servers"];
    else copy["mcp_servers"] = servers;
  }
  return copy;
}

/**
 * OpenAI Codex CLI reads TOML at ~/.codex/config.toml with an `mcp_servers`
 * table. Streamable-HTTP servers use `url` (no experimental flag needed since
 * ~v0.44). OAuth is supported per the MCP authorization spec — `auth` defaults
 * to "oauth" and `codex mcp login <name>` runs the browser flow — so a bare
 * `url` entry is the OAuth-first registration. Token fallback writes
 * `http_headers`; `bearer_token_env_var` is the secretless alternative when
 * the user prefers env vars.
 *
 * Edits splice only our table so the user's comments and layout survive.
 * The result is verified by re-parsing: if anything other than our entry
 * would change (say the server is defined inline rather than as a table),
 * the file is re-serialised instead, which is correct but drops comments.
 */
export function makeCodex(home: string = os.homedir()): McpClient {
  const configPath = path.join(home, ".codex", "config.toml");

  async function readConfig(): Promise<{ raw: string; cfg: Toml }> {
    const raw = (await readTextIfPresent(configPath)) ?? "";
    if (raw.trim() === "") return { raw: "", cfg: {} };
    try {
      return { raw, cfg: parseToml(raw) as Toml };
    } catch (err) {
      throw new Error(
        `Codex config at ${configPath} is not valid TOML — fix or remove it, then retry (${String(err)})`
      );
    }
  }

  /** Text for `cfg` with our entry set to `entry` (or removed), preserving comments when safe. */
  function render(raw: string, cfg: Toml, entry: Toml | undefined): string {
    const block =
      entry === undefined ? undefined : stringifyToml({ mcp_servers: { [SERVER_KEY]: entry } });
    const spliced = spliceServerTable(raw, block);
    try {
      const after = parseToml(spliced) as Toml;
      if (
        isDeepStrictEqual(withoutOurs(after), withoutOurs(cfg)) &&
        isDeepStrictEqual(after["mcp_servers"]?.[SERVER_KEY], entry)
      ) {
        return spliced;
      }
    } catch {
      /* fall through to a full rewrite */
    }
    const next: Toml = withoutOurs(cfg);
    if (entry !== undefined) {
      next["mcp_servers"] = { ...(next["mcp_servers"] ?? {}), [SERVER_KEY]: entry };
    }
    return stringifyToml(next) + "\n";
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
        const { cfg } = await readConfig();
        return Boolean(cfg["mcp_servers"]?.[SERVER_KEY]);
      } catch {
        return false;
      }
    },

    async register(opts: RegisterOptions) {
      const { raw, cfg } = await readConfig();
      const { url, headers } = endpointFor(opts.auth);
      const entry: Toml = { url };
      if (headers) entry["http_headers"] = headers;
      await writeConfigFile(configPath, render(raw, cfg, entry), {
        secret: opts.auth.kind === "token",
      });
    },

    async unregister() {
      const { raw, cfg } = await readConfig();
      if (!cfg["mcp_servers"]?.[SERVER_KEY]) return;
      await writeConfigFile(configPath, render(raw, cfg, undefined), { secret: false });
    },
  };
}

export const codex: McpClient = makeCodex();
