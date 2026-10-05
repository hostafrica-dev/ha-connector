import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { MCP_BEARER_URL, MCP_OAUTH_URL } from "@hostafrica/connector-core";

const CLI = path.join(__dirname, "..", "src", "index.js");

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the CLI against an isolated home. PATH points at an empty directory,
 * so `claude` (and `which` itself) can't be found and nothing on the real
 * machine is detected or touched.
 */
async function run(home: string, args: string[], env: Record<string, string> = {}): Promise<Run> {
  const bin = path.join(home, ".empty-bin");
  await fs.mkdir(bin, { recursive: true });
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], {
      env: { HOME: home, USERPROFILE: home, PATH: bin, SystemRoot: process.env.SystemRoot ?? "", ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

async function tmpHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ha-cli-"));
}

async function cursorEntry(home: string): Promise<unknown> {
  const raw = await fs.readFile(path.join(home, ".cursor", "mcp.json"), "utf8");
  return JSON.parse(raw).mcpServers?.hostafrica;
}

test("status lists every client, none detected in an empty home", async () => {
  const home = await tmpHome();
  const { code, stdout } = await run(home, ["status"]);
  assert.equal(code, 0);
  assert.equal(stdout.trim().split("\n").length, 9);
  assert.match(stdout, /^cursor\s+not detected\s+auth=oauth/m);
});

test("install with no arguments and nothing detected fails", async () => {
  const home = await tmpHome();
  const { code, stderr } = await run(home, ["install"]);
  assert.equal(code, 1);
  assert.match(stderr, /no clients detected/);
});

test("install <id> registers via OAuth by default, uninstall removes it", async () => {
  const home = await tmpHome();
  const installed = await run(home, ["install", "cursor"]);
  assert.equal(installed.code, 0, installed.stderr);
  assert.match(installed.stdout, /Cursor: registered \(OAuth/);
  assert.deepEqual(await cursorEntry(home), { url: MCP_OAUTH_URL });

  const removed = await run(home, ["uninstall", "cursor"]);
  assert.equal(removed.code, 0, removed.stderr);
  assert.equal(await cursorEntry(home), undefined);
});

for (const [label, args, env] of [
  ["--token <value>", ["install", "cursor", "--token", "tok_a"], {}],
  ["--token=<value>", ["install", "--token=tok_a", "cursor"], {}],
  ["HOSTAFRICA_API_TOKEN", ["install", "cursor"], { HOSTAFRICA_API_TOKEN: "tok_a" }],
] as const) {
  test(`a token from ${label} switches registration to the bearer endpoint`, async () => {
    const home = await tmpHome();
    const { code, stdout, stderr } = await run(home, [...args], { ...env });
    assert.equal(code, 0, stderr);
    assert.match(stdout, /registered \(API token/);
    assert.deepEqual(await cursorEntry(home), {
      url: MCP_BEARER_URL,
      headers: { Authorization: "Bearer tok_a" },
    });
  });
}

test("status reports token auth when a token is supplied", async () => {
  const home = await tmpHome();
  const { stdout } = await run(home, ["status", "--token", "tok_a"]);
  assert.match(stdout, /^cursor\s+not detected\s+auth=token/m);
});

test("--token without a value is an error", async () => {
  const home = await tmpHome();
  for (const args of [["install", "--token"], ["install", "--token="], ["install", "--token", "--x"]]) {
    const { code, stderr } = await run(home, args);
    assert.equal(code, 1, args.join(" "));
    assert.match(stderr, /--token requires a value/);
  }
});

test("an unknown client id is an error and writes nothing", async () => {
  const home = await tmpHome();
  const { code, stderr } = await run(home, ["install", "nope"]);
  assert.equal(code, 1);
  assert.match(stderr, /unknown client "nope"/);
  assert.deepEqual((await fs.readdir(home)).filter((f) => f !== ".empty-bin"), []);
});

test("help exits 0, an unknown command exits 1", async () => {
  const home = await tmpHome();
  assert.equal((await run(home, ["help"])).code, 0);
  assert.equal((await run(home, [])).code, 0);
  assert.equal((await run(home, ["frobnicate"])).code, 1);
});
