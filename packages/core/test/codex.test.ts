import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseToml } from "smol-toml";
import { makeCodex } from "../src/clients/codex";
import { MCP_BEARER_URL } from "../src/constants";

async function tmpHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ha-codex-"));
}

test("register (token) writes url + http_headers into config.toml", async () => {
  const home = await tmpHome();
  const codex = makeCodex(home);
  await codex.register({ auth: { kind: "token", token: "tok_1" } });
  const raw = await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8");
  const cfg = parseToml(raw) as any;
  assert.equal(cfg.mcp_servers.hostafrica.url, MCP_BEARER_URL);
  assert.deepEqual(cfg.mcp_servers.hostafrica.http_headers, {
    Authorization: "Bearer tok_1",
  });
  assert.equal(await codex.isRegistered(), true);
});

test("register preserves existing unrelated TOML content", async () => {
  const home = await tmpHome();
  const cfgPath = path.join(home, ".codex", "config.toml");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(
    cfgPath,
    `model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "npx"\nargs = ["other-mcp"]\n`
  );
  const codex = makeCodex(home);
  await codex.register({ auth: { kind: "oauth" } });
  const cfg = parseToml(await fs.readFile(cfgPath, "utf8")) as any;
  assert.equal(cfg.model, "gpt-5");
  assert.equal(cfg.mcp_servers.other.command, "npx");
  assert.ok(cfg.mcp_servers.hostafrica.url);
});

test("unregister removes only our table; detect follows ~/.codex", async () => {
  const home = await tmpHome();
  const codex = makeCodex(home);
  assert.equal(await codex.detect(), false);
  await codex.register({ auth: { kind: "token", token: "t" } });
  assert.equal(await codex.detect(), true);
  await codex.unregister();
  assert.equal(await codex.isRegistered(), false);
  const cfg = parseToml(
    await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8")
  ) as any;
  assert.equal(cfg.mcp_servers?.hostafrica, undefined);
});

test("register throws a clear error on invalid existing TOML", async () => {
  const home = await tmpHome();
  const cfgPath = path.join(home, ".codex", "config.toml");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(cfgPath, "[broken\n");
  const codex = makeCodex(home);
  await assert.rejects(() => codex.register({ auth: { kind: "oauth" } }), /not valid TOML/);
});

const COMMENTED = [
  "# my Codex settings",
  'model = "gpt-5" # default model',
  "",
  "# a server I wrote",
  "[mcp_servers.other]",
  'command = "npx"',
  'args = ["other-mcp"]',
  "",
  "# profiles below",
  "[profiles.fast]",
  'model = "gpt-5-mini"',
  "",
].join("\n");

test("register and unregister keep comments and layout", async () => {
  const home = await tmpHome();
  const cfgPath = path.join(home, ".codex", "config.toml");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(cfgPath, COMMENTED);
  const codex = makeCodex(home);

  await codex.register({ auth: { kind: "oauth" } });
  const registered = await fs.readFile(cfgPath, "utf8");
  assert.ok(registered.startsWith(COMMENTED), "existing text is untouched");
  assert.match(registered, /\[mcp_servers\.hostafrica\]\nurl = "https:\/\/mcp\.hostafrica\.com\/mcp"\n$/);

  await codex.unregister();
  assert.equal(await fs.readFile(cfgPath, "utf8"), COMMENTED);
});

test("re-registering replaces our table in place, subtables included", async () => {
  const home = await tmpHome();
  const cfgPath = path.join(home, ".codex", "config.toml");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(cfgPath, COMMENTED);
  const codex = makeCodex(home);
  await codex.register({ auth: { kind: "token", token: "tok_1" } });
  await codex.register({ auth: { kind: "oauth" } });
  const raw = await fs.readFile(cfgPath, "utf8");
  assert.doesNotMatch(raw, /http_headers|tok_1/);
  assert.match(raw, /# profiles below\n\[profiles\.fast\]/);
  const cfg = parseToml(raw) as any;
  assert.deepEqual(cfg.mcp_servers.hostafrica, { url: "https://mcp.hostafrica.com/mcp" });
  assert.equal(cfg.mcp_servers.other.command, "npx");
});

test("an inline definition falls back to a full rewrite that is still correct", async () => {
  const home = await tmpHome();
  const cfgPath = path.join(home, ".codex", "config.toml");
  await fs.mkdir(path.dirname(cfgPath), { recursive: true });
  await fs.writeFile(
    cfgPath,
    `model = "gpt-5"\n\n[mcp_servers]\nhostafrica = { url = "https://old.example/mcp" }\nother = { command = "npx" }\n`
  );
  const codex = makeCodex(home);
  await codex.register({ auth: { kind: "token", token: "tok_2" } });
  const cfg = parseToml(await fs.readFile(cfgPath, "utf8")) as any;
  assert.equal(cfg.model, "gpt-5");
  assert.equal(cfg.mcp_servers.other.command, "npx");
  assert.deepEqual(cfg.mcp_servers.hostafrica, {
    url: MCP_BEARER_URL,
    http_headers: { Authorization: "Bearer tok_2" },
  });
});
