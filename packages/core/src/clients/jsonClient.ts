import {
  Node,
  ParseError,
  SyntaxKind,
  applyEdits,
  createScanner,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
} from "jsonc-parser";
import { SERVER_KEY } from "../constants";
import { AuthMode, McpClient, RegisterOptions } from "../types";
import { exists, readTextIfPresent, writeConfigFile } from "../fsutil";

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

interface TextStyle {
  eol: string;
  /** One level of indentation, e.g. two spaces or a tab. */
  unit: string;
}

/** Match the file's existing indentation and line endings when editing it. */
function styleOf(raw: string): TextStyle {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const indent = /^([ \t]+)\S/m.exec(raw)?.[1];
  return { eol, unit: indent?.startsWith("\t") ? "\t" : (indent ?? "  ") };
}

/** Leading whitespace of the line containing `offset`. */
function indentAt(raw: string, offset: number): string {
  const start = raw.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(raw.slice(start))![0];
}

/** `value` pretty-printed in the file's style, continuation lines indented by `base`. */
function render(value: unknown, style: TextStyle, base: string): string {
  return JSON.stringify(value, null, style.unit).replace(/\n/g, style.eol + base);
}

/** Kind and offset of the first token at or after `offset`, skipping whitespace and comments. */
function nextToken(raw: string, offset: number): { kind: SyntaxKind; offset: number } {
  const scanner = createScanner(raw, true);
  scanner.setPosition(offset);
  const kind = scanner.scan();
  return { kind, offset: scanner.getTokenOffset() };
}

/**
 * Text with `"key": value` added as the last property of `obj`. Hand-built
 * rather than via jsonc-parser's formatter, which reformats the neighbouring
 * property and can move its trailing comment onto ours.
 */
function insertProperty(
  raw: string,
  obj: Node,
  key: string,
  value: unknown,
  style: TextStyle
): string {
  const children = obj.children ?? [];
  const objIndent = indentAt(raw, obj.offset);
  const first = children[0];
  const childIndent =
    first && raw.slice(obj.offset, first.offset).includes("\n")
      ? indentAt(raw, first.offset)
      : objIndent + style.unit;
  const prop = `${JSON.stringify(key)}: ${render(value, style, childIndent)}`;
  const last = children[children.length - 1];
  if (last) {
    const at = last.offset + last.length;
    const after = nextToken(raw, at);
    const trailingComma = after.kind === SyntaxKind.CommaToken;
    // Start our property on the next line, so a comment trailing the last
    // property stays with it rather than ending up after ours.
    const anchor = trailingComma ? after.offset + 1 : at;
    const eol = raw.indexOf("\n", anchor);
    const lineBreak = eol > 0 && raw[eol - 1] === "\r" ? eol - 1 : eol;
    if (eol !== -1 && /^[ \t]*(\/\/.*|\/\*.*\*\/[ \t]*)?$/.test(raw.slice(anchor, lineBreak))) {
      const comma = trailingComma ? "" : ",";
      const ownComma = trailingComma ? "," : "";
      return (
        raw.slice(0, at) +
        comma +
        raw.slice(at, lineBreak) +
        `${style.eol}${childIndent}${prop}${ownComma}` +
        raw.slice(lineBreak)
      );
    }
    return raw.slice(0, at) + `,${style.eol}${childIndent}${prop}` + raw.slice(at);
  }
  const at = obj.offset + 1; // just inside the opening brace
  return (
    raw.slice(0, at) + `${style.eol}${childIndent}${prop}${style.eol}${objIndent}` + raw.slice(at)
  );
}

/** Text with `[rootKey, SERVER_KEY]` set to `entry`, everything else untouched. */
function setEntry(raw: string, rootKey: string, entry: unknown): string {
  const style = styleOf(raw);
  const tree = parseTree(raw, [], { allowTrailingComma: true })!;
  const existing = findNodeAtLocation(tree, [rootKey, SERVER_KEY]);
  if (existing) {
    const base = indentAt(raw, existing.parent!.offset);
    return (
      raw.slice(0, existing.offset) +
      render(entry, style, base) +
      raw.slice(existing.offset + existing.length)
    );
  }
  const servers = findNodeAtLocation(tree, [rootKey]);
  if (servers) return insertProperty(raw, servers, SERVER_KEY, entry, style);
  return insertProperty(raw, tree, rootKey, { [SERVER_KEY]: entry }, style);
}

/**
 * Text with `[rootKey, SERVER_KEY]` removed. When our entry sits on its own
 * lines (the usual pretty-printed case) those lines go, along with the comma
 * that becomes dangling, and an emptied object collapses to `{}`. Otherwise
 * jsonc-parser removes just the property.
 */
function removeEntry(raw: string, rootKey: string): string {
  const tree = parseTree(raw, [], { allowTrailingComma: true })!;
  const value = findNodeAtLocation(tree, [rootKey, SERVER_KEY]);
  if (!value) return raw;
  const prop = value.parent!;
  const obj = prop.parent!;
  const siblings = obj.children!;
  const index = siblings.indexOf(prop);

  const after = nextToken(raw, prop.offset + prop.length);
  const hasComma = after.kind === SyntaxKind.CommaToken;
  const end = hasComma ? after.offset + 1 : prop.offset + prop.length;
  const lineStart = raw.lastIndexOf("\n", prop.offset - 1) + 1;
  const eol = raw.indexOf("\n", end);
  const lineEnd = eol === -1 ? raw.length : eol + 1;
  const ownLines =
    raw.slice(lineStart, prop.offset).trim() === "" &&
    /^[ \t]*(\/\/.*|\/\*.*\*\/[ \t]*)?\r?\n?$/.test(raw.slice(end, lineEnd));
  if (!ownLines) return applyEdits(raw, modify(raw, [rootKey, SERVER_KEY], undefined, {}));

  let text = raw.slice(0, lineStart) + raw.slice(lineEnd);
  let close = obj.offset + obj.length - 1 - (lineEnd - lineStart);
  if (!hasComma && index > 0) {
    // We were last: the previous property's comma would now dangle.
    const prev = siblings[index - 1];
    const comma = nextToken(text, prev.offset + prev.length);
    if (comma.kind === SyntaxKind.CommaToken) {
      text = text.slice(0, comma.offset) + text.slice(comma.offset + 1);
      close--;
    }
  }
  if (siblings.length === 1 && text.slice(obj.offset + 1, close).trim() === "") {
    text = text.slice(0, obj.offset + 1) + text.slice(close);
  }
  return text;
}

function isStrictJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/** `cfg` with `[rootKey][SERVER_KEY]` set to `entry`. */
function setIn(cfg: Record<string, any>, rootKey: string, entry: unknown): Record<string, any> {
  return { ...cfg, [rootKey]: { ...(cfg[rootKey] ?? {}), [SERVER_KEY]: entry } };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Most AI clients read a JSON file with a `{ [rootKey]: { [name]: entry } }`
 * shape and differ only in path and entry fields. This factory covers them.
 * Edits are applied in place to the file's text, so entries for other
 * servers, comments (several clients accept JSONC) and the user's formatting
 * all survive; only the HostAfrica entry changes.
 */
export function jsonClient(spec: JsonClientSpec): McpClient {
  async function readConfig(): Promise<{ raw: string; cfg: Record<string, any> }> {
    const raw = (await readTextIfPresent(spec.configPath)) ?? "";
    if (raw.trim() === "") return { raw: "", cfg: {} };
    const errors: ParseError[] = [];
    const cfg = parse(raw, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
      const { error, offset } = errors[0];
      throw new Error(
        `${spec.name} config at ${spec.configPath} is not valid JSON — fix or remove it, then retry (${printParseErrorCode(error)} at offset ${offset})`
      );
    }
    if (!isObject(cfg) || (cfg[spec.rootKey] !== undefined && !isObject(cfg[spec.rootKey]))) {
      throw new Error(
        `${spec.name} config at ${spec.configPath} has an unexpected shape — "${spec.rootKey}" must be an object`
      );
    }
    return { raw, cfg };
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
        const { cfg } = await readConfig();
        return Boolean(cfg[spec.rootKey]?.[SERVER_KEY]);
      } catch {
        return false;
      }
    },

    async register(opts: RegisterOptions) {
      const { raw } = await readConfig();
      const entry = spec.buildEntry(opts.auth);
      let text: string;
      if (raw === "") {
        text = JSON.stringify({ [spec.rootKey]: { [SERVER_KEY]: entry } }, null, 2) + "\n";
      } else if (!raw.trim().includes("\n") && isStrictJson(raw)) {
        // A minified one-liner holds no comments or layout to keep: pretty-print it.
        text = JSON.stringify(setIn(JSON.parse(raw), spec.rootKey, entry), null, 2) + "\n";
      } else {
        text = setEntry(raw, spec.rootKey, entry);
      }
      await writeConfigFile(spec.configPath, text, { secret: opts.auth.kind === "token" });
    },

    async unregister() {
      const { raw, cfg } = await readConfig();
      if (!cfg[spec.rootKey]?.[SERVER_KEY]) return;
      await writeConfigFile(spec.configPath, removeEntry(raw, spec.rootKey), { secret: false });
    },
  };
}
