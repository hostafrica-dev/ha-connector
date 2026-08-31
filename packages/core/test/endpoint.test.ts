import { test } from "node:test";
import assert from "node:assert/strict";
import { endpointFor } from "../src/types";
import { claudeAddArgs } from "../src/clients/claudeCode";
import { MCP_BEARER_URL, MCP_OAUTH_URL, SERVER_KEY } from "../src/constants";

test("endpointFor oauth → OAuth endpoint, no headers", () => {
  const ep = endpointFor({ kind: "oauth" });
  assert.equal(ep.url, MCP_OAUTH_URL);
  assert.equal(ep.headers, undefined);
});

test("endpointFor token → Bearer endpoint with Authorization header", () => {
  const ep = endpointFor({ kind: "token", token: "tok_123" });
  assert.equal(ep.url, MCP_BEARER_URL);
  assert.deepEqual(ep.headers, { Authorization: "Bearer tok_123" });
});

test("claudeAddArgs oauth → user-scoped http transport, no --header", () => {
  const args = claudeAddArgs({ kind: "oauth" });
  assert.deepEqual(args, [
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "http",
    SERVER_KEY,
    MCP_OAUTH_URL,
  ]);
});

test("claudeAddArgs token → bearer URL plus Authorization --header", () => {
  const args = claudeAddArgs({ kind: "token", token: "tok_123" });
  assert.equal(args[args.length - 3], MCP_BEARER_URL);
  assert.equal(args[args.length - 2], "--header");
  assert.equal(args[args.length - 1], "Authorization: Bearer tok_123");
});
