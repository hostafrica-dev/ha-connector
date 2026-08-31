import { MCP_OAUTH_URL, SERVER_KEY } from "./constants";

/**
 * One-click Cursor install link for the docs site / client panel — registers
 * the OAuth endpoint with no extension involved. Format per
 * cursor.com/docs/mcp/install-links: base64 of the server's config object.
 */
export function cursorInstallDeeplink(): string {
  const config = { type: "http", url: MCP_OAUTH_URL };
  const b64 = Buffer.from(JSON.stringify(config), "utf8").toString("base64");
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_KEY}&config=${encodeURIComponent(b64)}`;
}
