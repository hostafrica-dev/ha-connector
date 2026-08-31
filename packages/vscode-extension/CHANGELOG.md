# Changelog

## 1.0.0

First stable release.

- Native MCP registration in VS Code through the `McpServerDefinitionProvider` API (VS Code 1.101+). Points at the HostAfrica OAuth endpoint; VS Code drives the browser sign-in, and no credentials are stored.
- Activity-bar view listing detected AI clients with per-client register and remove.
- Connect and Disconnect commands: register the HostAfrica MCP server with every detected client, or remove it everywhere and clear stored secrets.
- API-token fallback for clients without MCP OAuth support, stored in VS Code SecretStorage; tokens written to other clients' config files get file mode 600.
- Getting-started walkthrough and the HostAfrica brand icon.
- Integration tests against a real VS Code instance (`npm run test:vscode`).

The registrar (shared with the `@hostafrica/connect` CLI) covers nine clients: Claude Code, Cursor, Windsurf, Gemini CLI, Codex CLI, Antigravity, Devin CLI, JetBrains Junie, and Claude Desktop (via an `mcp-remote` bridge). End-to-end browser OAuth verified on VS Code, Claude Code, Codex and Cursor.
