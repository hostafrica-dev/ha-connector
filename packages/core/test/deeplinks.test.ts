import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorInstallDeeplink } from "../src/deeplinks";
import { MCP_OAUTH_URL, SERVER_KEY } from "../src/constants";

test("cursor deeplink round-trips to an http config for the OAuth endpoint", () => {
  const link = cursorInstallDeeplink();
  const url = new URL(link);
  assert.equal(url.protocol, "cursor:");
  assert.equal(url.host, "anysphere.cursor-deeplink");
  assert.equal(url.pathname, "/mcp/install");
  assert.equal(url.searchParams.get("name"), SERVER_KEY);
  const decoded = JSON.parse(
    Buffer.from(url.searchParams.get("config")!, "base64").toString("utf8")
  );
  assert.deepEqual(decoded, { type: "http", url: MCP_OAUTH_URL });
});
