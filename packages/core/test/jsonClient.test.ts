import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { jsonClient } from "../src/clients/jsonClient";
import { endpointFor } from "../src/types";
import { MCP_BEARER_URL, MCP_OAUTH_URL } from "../src/constants";

async function tmpdir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ha-json-"));
}

function makeClient(dir: string) {
  return jsonClient({
    id: "fake",
    name: "Fake Client",
    supportsOAuth: true,
    configPath: path.join(dir, "cfg", "mcp.json"),
    detectPaths: [path.join(dir, "cfg")],
    rootKey: "mcpServers",
    buildEntry(auth) {
      const { url, headers } = endpointFor(auth);
      return headers ? { url, headers } : { url };
    },
  });
}

test("register (oauth) creates the config with only a url", async () => {
  const dir = await tmpdir();
  const client = makeClient(dir);
  await client.register({ auth: { kind: "oauth" } });
  const cfg = JSON.parse(await fs.readFile(path.join(dir, "cfg", "mcp.json"), "utf8"));
  assert.deepEqual(cfg.mcpServers.hostafrica, { url: MCP_OAUTH_URL });
  assert.equal(await client.isRegistered(), true);
});

test("register (token) writes bearer endpoint + Authorization header", async () => {
  const dir = await tmpdir();
  const client = makeClient(dir);
  await client.register({ auth: { kind: "token", token: "tok_9" } });
  const cfg = JSON.parse(await fs.readFile(path.join(dir, "cfg", "mcp.json"), "utf8"));
  assert.deepEqual(cfg.mcpServers.hostafrica, {
    url: MCP_BEARER_URL,
    headers: { Authorization: "Bearer tok_9" },
  });
});

test("register preserves other servers and unrelated top-level keys", async () => {
  const dir = await tmpdir();
  const cfgPath = path.join(dir, "cfg", "mcp.json");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(
    cfgPath,
    JSON.stringify({
      theme: "dark",
      mcpServers: { other: { url: "https://example.com/mcp" } },
    })
  );
  const client = makeClient(dir);
  await client.register({ auth: { kind: "oauth" } });
  const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8"));
  assert.equal(cfg.theme, "dark");
  assert.deepEqual(cfg.mcpServers.other, { url: "https://example.com/mcp" });
  assert.ok(cfg.mcpServers.hostafrica);
});

test("unregister removes only our entry; missing file is a no-op", async () => {
  const dir = await tmpdir();
  const client = makeClient(dir);
  await client.unregister(); // no file yet — must not throw
  await client.register({ auth: { kind: "oauth" } });
  const cfgPath = path.join(dir, "cfg", "mcp.json");
  const before = JSON.parse(await fs.readFile(cfgPath, "utf8"));
  before.mcpServers.keepme = { url: "https://example.com/mcp" };
  await fs.writeFile(cfgPath, JSON.stringify(before));
  await client.unregister();
  const after = JSON.parse(await fs.readFile(cfgPath, "utf8"));
  assert.equal(after.mcpServers.hostafrica, undefined);
  assert.ok(after.mcpServers.keepme);
  assert.equal(await client.isRegistered(), false);
});

test("register throws a clear error on invalid existing JSON", async () => {
  const dir = await tmpdir();
  const cfgPath = path.join(dir, "cfg", "mcp.json");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(cfgPath, "{not json");
  const client = makeClient(dir);
  await assert.rejects(
    () => client.register({ auth: { kind: "oauth" } }),
    /not valid JSON/
  );
  // and isRegistered degrades to false rather than throwing
  assert.equal(await client.isRegistered(), false);
});

test("detect reflects detectPaths existence", async () => {
  const dir = await tmpdir();
  const client = makeClient(dir);
  assert.equal(await client.detect(), false);
  await fs.mkdir(path.join(dir, "cfg"), { recursive: true });
  assert.equal(await client.detect(), true);
});

test("config file is written mode 600 even if it pre-existed looser", async (t) => {
  if (process.platform === "win32") return t.skip("POSIX permissions only");
  const dir = await tmpdir();
  const cfgPath = path.join(dir, "cfg", "mcp.json");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(cfgPath, "{}", { mode: 0o644 });
  const client = makeClient(dir);
  await client.register({ auth: { kind: "token", token: "tok" } });
  const stat = await fs.stat(cfgPath);
  assert.equal(stat.mode & 0o777, 0o600);
});

test("config file containing a token is ACL-restricted to the current user on Windows", async (t) => {
  if (process.platform !== "win32") return t.skip("Windows ACLs only");
  const dir = await tmpdir();
  const cfgPath = path.join(dir, "cfg", "mcp.json");
  const client = makeClient(dir);
  await client.register({ auth: { kind: "token", token: "tok" } });
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)("icacls", [cfgPath]);
  // icacls prints "PRINCIPAL:(perms)" per ACE; the first is prefixed by the path.
  const aces = stdout
    .replace(cfgPath, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /:\(.*\)$/.test(l))
    .map((l) => {
      const i = l.lastIndexOf(":(");
      return { principal: l.slice(0, i), perms: l.slice(i + 1) };
    });
  const user = process.env.USERNAME ?? "";
  const isUser = (p: string) => p.toLowerCase().endsWith(`\\${user.toLowerCase()}`);
  // Only the owner and the root-equivalent principals may remain.
  const allowed = (p: string) =>
    isUser(p) || /^NT AUTHORITY\\SYSTEM$/i.test(p) || /^BUILTIN\\Administrators$/i.test(p);
  assert.ok(aces.length > 0, `no ACEs parsed from: ${stdout}`);
  for (const ace of aces) {
    assert.ok(allowed(ace.principal), `unexpected principal ${ace.principal} in: ${stdout}`);
    assert.ok(!ace.perms.includes("(I)"), `inherited ACE ${ace.principal} in: ${stdout}`);
  }
  assert.ok(
    aces.some((a) => isUser(a.principal) && a.perms.includes("(F)")),
    `current user lacks full control in: ${stdout}`,
  );
});
