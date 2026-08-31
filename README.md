# HostAfrica Connector

![release](https://img.shields.io/badge/release-v1.0.1-2e3388) ![license](https://img.shields.io/badge/license-MIT-109235) ![MCP](https://img.shields.io/badge/protocol-MCP-555)

Register the HostAfrica remote MCP server with your AI tools (editors, CLI agents, chat apps), so your assistant can manage VPS servers, DNS, domains, backups and orders from plain-language prompts.

Nothing runs locally. The MCP server is HostAfrica's hosted endpoint (`https://mcp.hostafrica.com/mcp`), so connecting a tool means writing one entry into that tool's config. This repo automates exactly that, three ways:

| Vehicle | For |
|---|---|
| CLI installer ([`packages/cli`](packages/cli)) | Any machine, any terminal: `hostafrica-connect install` detects your AI tools and registers them all |
| VS Code extension ([`packages/vscode-extension`](packages/vscode-extension)) | VS Code natively, plus a sidebar that registers every other detected tool; also serves Cursor/Windsurf/Antigravity/Devin users via Open VSX |
| Registrar core ([`packages/core`](packages/core)) | The shared library both wrap: client detection, config read/merge/write, OAuth/token modes |

## Install

The extension ships as a `.vsix` on the [latest release](https://github.com/hostafrica-dev/ha-connector/releases/latest). Download it and install into any VS Code-based editor:

```bash
code --install-extension connector-1.0.1.vsix
```

Swap `code` for `cursor` or `windsurf` to install into those. For terminals and CLI agents, install the CLI from npm: `npm install -g @hostafrica/connect`.

## Connect your platform

Every row was verified against the platform's current docs or source (Aug 2026). "Installer" means the CLI (`hostafrica-connect install <id>`) or the extension's sidebar; both write the same config.

| Platform | How to connect | Sign-in |
|---|---|---|
| Claude Code | Installer (`claude-code`), or manually: `claude mcp add --scope user --transport http hostafrica https://mcp.hostafrica.com/mcp` | Browser OAuth via `/mcp` in-session, or `claude mcp login hostafrica` for headless |
| Claude Desktop | Two ways, [see below](#claude-desktop-two-ways) | Browser OAuth |
| claude.ai / mobile / Cowork | Settings → Connectors → *Add custom connector* → paste `https://mcp.hostafrica.com/mcp` | Browser OAuth (the Free plan allows one custom connector) |
| ChatGPT | Add as a remote MCP connector (see the [developer docs](https://www.hostafrica.com/developers/)) | Browser OAuth |
| Cursor | Installer (`cursor`), the one-click install deeplink, or edit `~/.cursor/mcp.json` | Browser OAuth (Cursor 1.0+) |
| VS Code (Copilot) | Install the extension; it registers the server natively (VS Code 1.101+) | Browser OAuth, driven by VS Code |
| Windsurf | Installer (`windsurf`) writes `~/.codeium/windsurf/mcp_config.json`; then Refresh in the MCP panel | Browser OAuth |
| OpenAI Codex CLI | Installer (`codex`) writes `~/.codex/config.toml`, or `codex mcp add hostafrica --url https://mcp.hostafrica.com/mcp` | `codex mcp login hostafrica` |
| Gemini CLI | Installer (`gemini-cli`) writes `~/.gemini/settings.json` | Browser OAuth; `/mcp auth` in-CLI |
| Google Antigravity | Installer (`antigravity`) writes `~/.gemini/config/mcp_config.json` | Browser OAuth |
| Devin CLI | Installer (`devin-cli`) writes `~/.config/devin/mcp_config.json` | `devin mcp login hostafrica` |
| Devin (cloud) | Settings → Connections → MCP servers (org admins) | OAuth or auth header |
| JetBrains Junie | Installer (`junie`) writes `~/.junie/mcp/mcp.json` | Browser OAuth ("Authorize") |
| JetBrains AI Assistant | Settings → Tools → AI Assistant → MCP → paste `{"mcpServers": {"hostafrica": {"url": "https://api.hostafrica.com/mcp", "headers": {"Authorization": "Bearer <token>"}}}}` (2025.3+; no OAuth flow in this UI) | API token |
| Zed | Add to `context_servers` in settings.json: `{"url": "https://mcp.hostafrica.com/mcp"}` (installer support planned) | Browser OAuth |
| Anything stdio-only | `npx mcp-remote https://mcp.hostafrica.com/mcp` as a stdio bridge | Browser OAuth |

### CLI usage

```bash
hostafrica-connect status                 # what's installed, what's registered
hostafrica-connect install                # register with everything detected
hostafrica-connect install cursor codex   # or pick specific clients
hostafrica-connect uninstall              # remove all registrations
```

### Claude Desktop, two ways

Claude Desktop can connect to a remote MCP server in two different ways, and they are not the same. Pick one.

**1. Native custom connector (recommended).** In Claude Desktop: Settings → Connectors → *Add custom connector* → paste `https://mcp.hostafrica.com/mcp`. This is the cleanest path: no extra software, Claude signs you in through the browser, and the connection is managed in the app. It works on Free (one custom connector), Pro, Max, Team and Enterprise. Nothing to install, and the CLI is not involved.

**2. CLI installer / `mcp-remote` bridge.** `hostafrica-connect install claude-desktop` writes an entry into `claude_desktop_config.json` that launches `npx mcp-remote` as a local stdio process, which then talks to the remote server for Claude. Use this if you would rather manage the connection from a config file, or the native connector is not available to you. Two things to know:

- It needs **Node.js installed**, because it runs `npx mcp-remote`. The native path does not.
- The config file entry is stdio, not a remote URL, because Claude Desktop's config file only accepts stdio servers. That is why the bridge exists at all.

Both end up at the same place (browser OAuth to your HostAfrica account); the native connector is just less moving parts. If you are not sure, use option 1.

## What you can do once connected

Ask your assistant things like:

- *List my VPS servers* / *Reboot web-01* / *Create a snapshot before I deploy*
- *Add an A record for app.mydomain.co.za pointing at 102.0.0.10*
- *Is mydomain.africa available? Suggest alternatives*
- *Set up a weekly backup schedule for db-01*
- *Show my open orders and retry the failed payment*

~72 tools are live: VPS lifecycle, backups/snapshots, firewall, rDNS, power tasks, monitoring, DNS/DNSSEC, domains, catalogue/orders/payments.

## Authentication

Registrations point at the OAuth endpoint with no credentials. Your tool opens the browser and you sign in to HostAfrica; grants are scoped to your account and revocable in the [Client Area](https://panel.hostafrica.com/). The endpoint supports Dynamic Client Registration, PKCE and refresh tokens, so every platform above can run the flow itself.

For the rare case OAuth can't run (JetBrains AI Assistant, CI), generate an API token in the Client Area and pass `--token <token>` or set `HOSTAFRICA_API_TOKEN`. Registrations then use the Bearer endpoint (`https://api.hostafrica.com/mcp`). Tokens written into third-party config files are plaintext by necessity; the files are chmod 600, and the VS Code extension keeps its own copy in encrypted SecretStorage.

## Try it from source

Until the packages are published, everything runs from this repo. One-time setup:

```bash
npm install
npm run build
```

`npm install` resolves the workspace: external dependencies land in the root `node_modules/`, and the three local packages are symlinked into it so the CLI and extension resolve `@hostafrica/connector-core` to `packages/core` rather than npm. `npm run build` compiles core, then cli, then the extension, in that order; the extension is bundled with esbuild (core baked in) so the `.vsix` doesn't depend on the workspace symlink.

### CLI

Run in place, or link it onto your PATH:

```bash
node packages/cli/dist/index.js status
```

```bash
npm link --workspace packages/cli   # then: hostafrica-connect status
```

```bash
hostafrica-connect install claude-code cursor   # no args = all detected clients
```

`install` and `uninstall` write your real tool configs (`~/.cursor/mcp.json`, `~/.codex/config.toml`, and so on); run `status` first to see what would be touched. No token is needed: after installing, each tool asks you to sign in via the browser on first use. In Claude Code run `/mcp` (or `claude mcp login hostafrica` headless), in Codex `codex mcp login hostafrica`; Cursor, Windsurf and Gemini CLI prompt by themselves.

### VS Code extension

Quick dev run: open this folder in VS Code and press F5 ("Run HostAfrica Connector Extension"). An Extension Development Host opens with the HostAfrica icon in the activity bar; verify the native MCP registration with the "MCP: List Servers" command (VS Code 1.101+).

Package your own `.vsix` (or just grab the one from the [latest release](https://github.com/hostafrica-dev/ha-connector/releases/latest)):

```bash
cd packages/vscode-extension && npm run package
```

```bash
code --install-extension packages/vscode-extension/connector-1.0.1.vsix
```

Cursor and Windsurf accept the same flag; swap `code` for `cursor` or `windsurf`.

### Tests

```bash
npm test   # unit suite for the registrar core (node:test)
```

```bash
npm run test:vscode --workspace packages/vscode-extension   # integration tests: downloads a real VS Code, opens a window briefly
```

## Contributing

Issues and pull requests are welcome. A good first step is running `npm install && npm run build && npm test` to confirm the toolchain works. Adding a new AI client is usually one small adapter in [`packages/core/src/clients`](packages/core/src/clients) plus a test.

## Security

The connector only ever writes a server URL, and (in the token fallback) an API token, into your local tool configs. It never sends your token anywhere except the HostAfrica MCP endpoint you signed in to. Found a security issue? Please report it privately through this repo's Security tab (GitHub private vulnerability reporting) rather than opening a public issue.

## License

[MIT](LICENSE) © HostAfrica
