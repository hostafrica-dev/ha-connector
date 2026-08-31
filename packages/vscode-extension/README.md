# HostAfrica Connector

Manage your HostAfrica VPS, DNS and domains by asking your AI assistant. This extension registers the HostAfrica [remote MCP server](https://modelcontextprotocol.io/) with VS Code natively — and, if you want, with every other AI tool on your machine.

No API keys to paste. VS Code drives the browser sign-in, and the registration itself carries no credentials.

## What you can ask

Once connected, in Copilot Chat (or any connected assistant):

- *List my VPS servers* / *Reboot web-01* / *Create a snapshot before I deploy*
- *Add an A record for app.mydomain.co.za pointing at 102.0.0.10*
- *Is mydomain.africa available? Suggest alternatives*
- *Set up a weekly backup schedule for db-01*
- *Show my open orders and retry the failed payment*

Around 72 tools are live: VPS lifecycle, backups and snapshots, firewall, rDNS, power tasks, monitoring, DNS and DNSSEC, domains, and catalogue/orders/payments.

## Getting started

1. Install the extension. It registers the HostAfrica MCP server with VS Code through the `McpServerDefinitionProvider` API (VS Code 1.101+) — nothing to configure.
2. Open Copilot Chat and ask something. VS Code opens your browser for HostAfrica sign-in on first use.
3. That's it. The **Get started with HostAfrica Connector** walkthrough covers the same three steps if you'd rather click through it.

## The HostAfrica sidebar

The HostAfrica icon in the activity bar lists every AI client detected on your machine and whether each one is registered.

| Command | What it does |
|---|---|
| **HostAfrica: Connect** | Register the server with every detected client at once |
| **HostAfrica: Disconnect** | Remove it everywhere and clear any stored token |
| **HostAfrica: Register with Client…** | Register a single client |
| **HostAfrica: Remove from Client…** | Unregister a single client |
| **HostAfrica: Set API Token** | Store a token for clients that can't run OAuth |
| **HostAfrica: Open Client Area** | Review or revoke access |

Registering from here writes the same config the tool would write itself, so Claude Code, Cursor, Windsurf, Codex CLI, Gemini CLI, Antigravity, Devin CLI, JetBrains Junie and Claude Desktop all pick it up. Each still runs its own browser sign-in the first time you use it.

## Authentication

Registrations point at the OAuth endpoint (`https://mcp.hostafrica.com/mcp`) with no credentials in them. Your tool opens the browser, you sign in, and the grant is scoped to your account and revocable anytime in the [Client Area](https://panel.hostafrica.com/). The endpoint supports Dynamic Client Registration, PKCE and refresh tokens, so each client runs the flow itself.

For the rare case OAuth can't run (JetBrains AI Assistant, CI), generate an API token in the Client Area and use **HostAfrica: Set API Token**. The extension keeps its copy in VS Code's encrypted SecretStorage; tokens it writes into other tools' config files are chmod 600.

## Other editors and terminals

The extension works in any VS Code-based editor. For terminals and CLI agents there's a standalone installer that shares the same registrar:

```bash
hostafrica-connect install          # register every detected AI tool
hostafrica-connect status           # see what's installed and registered
```

## Links

- [Source and issues on GitHub](https://github.com/hostafrica-dev/ha-connector)
- [Developer docs](https://hostafrica.com/developers/)
- [HostAfrica Client Area](https://panel.hostafrica.com/)
- [Changelog](https://github.com/hostafrica-dev/ha-connector/blob/main/packages/vscode-extension/CHANGELOG.md)

MIT licensed.
