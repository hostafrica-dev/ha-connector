/** OAuth 2.0 MCP endpoint — clients implementing the MCP authorization spec
 *  drive the browser flow themselves; no credentials are written anywhere. */
export const MCP_OAUTH_URL = "https://mcp.hostafrica.com/mcp";

/** Bearer-token MCP endpoint — fallback for clients without MCP OAuth support. */
export const MCP_BEARER_URL = "https://api.hostafrica.com/mcp";

/** Key under which the server is registered in every client's config. */
export const SERVER_KEY = "hostafrica";

/** Human-facing label for the server. */
export const SERVER_LABEL = "HostAfrica";

export const CLIENT_AREA_URL = "https://panel.hostafrica.com/";
export const DEVELOPER_DOCS_URL = "https://www.hostafrica.com/developers/";
