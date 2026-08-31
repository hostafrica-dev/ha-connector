import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createClients, claudeDesktopConfigPath } from "../src/clients/registry";
import { MCP_BEARER_URL, MCP_OAUTH_URL } from "../src/constants";

async function tmpHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ha-reg-"));
}

test("registry exposes the expected client ids", () => {
  const ids = createClients("/nonexistent").map((c) => c.id);
  assert.deepEqual(ids, [
    "claude-code",
    "cursor",
    "windsurf",
    "gemini-cli",
    "codex",
    "antigravity",
    "devin-cli",
    "junie",
    "claude-desktop",
  ]);
});

test("every client is OAuth-capable (verified Aug 2026)", () => {
  for (const client of createClients("/nonexistent")) {
    assert.equal(client.supportsOAuth, true, `${client.id} should support OAuth`);
  }
});

test("file-based clients are not detected in an empty home", async () => {
  const home = await tmpHome();
  const fileClients = createClients(home).filter((c) => c.id !== "claude-code");
  for (const client of fileClients) {
    assert.equal(await client.detect(), false, `${client.id} should not be detected`);
  }
});

test("cursor adapter round-trips oauth registration via createClients(home)", async () => {
  const home = await tmpHome();
  await fs.mkdir(path.join(home, ".cursor"), { recursive: true });
  const cursor = createClients(home).find((c) => c.id === "cursor")!;
  assert.equal(await cursor.detect(), true);
  assert.equal(await cursor.isRegistered(), false);
  await cursor.register({ auth: { kind: "oauth" } });
  assert.equal(await cursor.isRegistered(), true);
  const cfg = JSON.parse(
    await fs.readFile(path.join(home, ".cursor", "mcp.json"), "utf8")
  );
  assert.deepEqual(cfg.mcpServers.hostafrica, { url: MCP_OAUTH_URL });
  await cursor.unregister();
  assert.equal(await cursor.isRegistered(), false);
});

test("every client differs in config target", () => {
  const targets = createClients("/tmp/x").map((c) => c.describeTarget());
  assert.equal(new Set(targets).size, targets.length);
});

test("claude-desktop bridges via mcp-remote (oauth: bare, token: env header)", async () => {
  const home = await tmpHome();
  await fs.mkdir(path.dirname(claudeDesktopConfigPath(home)), { recursive: true });
  const cd = createClients(home).find((c) => c.id === "claude-desktop")!;
  assert.equal(await cd.detect(), true);

  // OAuth: a bare mcp-remote stdio entry against the OAuth endpoint.
  await cd.register({ auth: { kind: "oauth" } });
  let cfg = JSON.parse(await fs.readFile(claudeDesktopConfigPath(home), "utf8"));
  assert.deepEqual(cfg.mcpServers.hostafrica, {
    command: "npx",
    args: ["-y", "mcp-remote", MCP_OAUTH_URL],
  });
  assert.equal(await cd.isRegistered(), true);

  // Token: bearer via env var, header references it, no spaces in args.
  await cd.register({ auth: { kind: "token", token: "tok_42" } });
  cfg = JSON.parse(await fs.readFile(claudeDesktopConfigPath(home), "utf8"));
  assert.deepEqual(cfg.mcpServers.hostafrica, {
    command: "npx",
    args: ["-y", "mcp-remote", MCP_BEARER_URL, "--header", "Authorization:${HOSTAFRICA_AUTH}"],
    env: { HOSTAFRICA_AUTH: "Bearer tok_42" },
  });

  await cd.unregister();
  assert.equal(await cd.isRegistered(), false);
});
