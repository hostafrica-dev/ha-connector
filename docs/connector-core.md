# @hostafrica/connector-core

The registrar behind the HostAfrica Connector: detect which AI clients are installed on a machine, and register the HostAfrica [remote MCP server](https://modelcontextprotocol.io/) with each of them. OAuth first, with an API-token fallback.

This is the shared library. Most people want one of the two things built on it:

- [`@hostafrica/connect`](https://www.npmjs.com/package/@hostafrica/connect): the CLI, `npx @hostafrica/connect install`
- [HostAfrica Connector for VS Code](https://github.com/hostafrica-dev/ha-connector/tree/main/packages/vscode-extension): the extension

Reach for this package directly if you're building your own installer, panel action or onboarding flow.

## Install

```bash
npm install @hostafrica/connector-core
```

CommonJS, targets ES2022, no runtime dependencies beyond `smol-toml` (for Codex CLI's TOML config). Requires Node 18 or newer.

## Usage

```ts
import { clientStatuses, clientById } from "@hostafrica/connector-core";

// What's installed, and what's already registered?
for (const { client, installed, registered } of await clientStatuses()) {
  console.log(client.id, installed, registered, client.describeTarget());
}

// Register one client using the browser OAuth flow.
await clientById("cursor")?.register({ auth: { kind: "oauth" } });
```

Every client implements the same interface, so callers don't need to know whether a given tool stores config as JSON, as TOML, or behind a CLI:

```ts
interface McpClient {
  id: string;                              // "cursor"
  name: string;                            // "Cursor"
  supportsOAuth: boolean;                  // false → registration needs a token
  detect(): Promise<boolean>;              // installed on this machine?
  isRegistered(): Promise<boolean>;        // HostAfrica already present?
  register(opts: RegisterOptions): Promise<void>;
  unregister(): Promise<void>;
  describeTarget(): string;                // config path or command, for display
}
```

### API

| Export | Purpose |
|---|---|
| `allClients()` | Every client the registrar can configure |
| `clientById(id)` | One client by its stable id, or `undefined` |
| `clientStatuses()` | `{ client, installed, registered }` for all of them |
| `createClients(home?)` | Build the client set rooted at a given home directory (tests pass a temp dir) |
| `endpointFor(auth)` | Resolve the URL and headers an auth mode maps to |
| `jsonClient(spec)` | Factory for the common `{ mcpServers: { … } }` config shape |
| `cursorInstallDeeplink()` | One-click `cursor://` install link, no extension involved |
| `claudeAddArgs(auth)` | The `claude mcp add` argument list, as a pure function |
| `makeCodex(home?)` | Codex CLI adapter rooted at a given home |

Constants: `MCP_OAUTH_URL`, `MCP_BEARER_URL`, `SERVER_KEY`, `SERVER_LABEL`, `CLIENT_AREA_URL`, `DEVELOPER_DOCS_URL`.

## Supported clients

| id | Registration target |
|---|---|
| `claude-code` | `claude mcp add`, user scope |
| `cursor` | `~/.cursor/mcp.json` |
| `windsurf` | `~/.codeium/windsurf/mcp_config.json` |
| `gemini-cli` | `~/.gemini/settings.json` |
| `codex` | `~/.codex/config.toml` |
| `antigravity` | `~/.gemini/config/mcp_config.json` |
| `devin-cli` | `~/.config/devin/mcp_config.json` |
| `junie` | `~/.junie/mcp/mcp.json` |
| `claude-desktop` | `claude_desktop_config.json`, bridged via `npx mcp-remote` |

VS Code is deliberately absent: the extension registers the server natively through the `McpServerDefinitionProvider` API rather than writing a config file.

Clients differ in more than path. Windsurf and Antigravity want `serverUrl`, Gemini CLI wants `httpUrl`, Devin CLI wants `url` plus `transport: "http"`, Codex uses TOML, and Claude Desktop only accepts stdio servers so it's bridged through `mcp-remote`. `jsonClient()` covers the common shape; the rest are hand-written adapters.

## Auth modes

```ts
type AuthMode =
  | { kind: "oauth" }
  | { kind: "token"; token: string };
```

OAuth registrations contain no credentials, only the endpoint. The client runs its own browser sign-in against a server supporting Dynamic Client Registration, PKCE and refresh tokens. Prefer this wherever `supportsOAuth` is true.

Token mode writes an `Authorization: Bearer <token>` header into the client's config, for the rare tool that can't run OAuth. Files written this way are `chmod 600`.

Writes are read-modify-write: entries for other MCP servers, and unrelated top-level keys, are preserved. Invalid existing JSON or TOML raises a clear error naming the file rather than overwriting it.

## Links

- [Source and issues](https://github.com/hostafrica-dev/ha-connector)
- [Developer docs](https://www.hostafrica.com/developers/)
- [HostAfrica Client Area](https://panel.hostafrica.com/)

MIT licensed.
