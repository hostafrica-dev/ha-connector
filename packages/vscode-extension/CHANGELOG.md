# Changelog

## 1.0.2

Security hardening for Windows. No changes to OAuth registrations.

- Config files that contain an API token now get an explicit owner-only NTFS ACL on Windows, where POSIX mode 600 has no effect. Inherited entries and the Everyone, Authenticated Users and Users groups are removed; SYSTEM and Administrators keep access, as root does on POSIX.
- The core test suite now runs on Windows in CI and verifies the resulting ACL.
- Documentation describes the per-platform file protection instead of "chmod 600".

## 1.0.1

Documentation and packaging update. No functional changes.

- README documentation added for the published packages.
- Repository and marketplace metadata updated.

## 1.0.0

First stable release.

- Native MCP registration in VS Code through the `McpServerDefinitionProvider` API (VS Code 1.101+). Points at the HostAfrica OAuth endpoint; VS Code drives the browser sign-in, and no credentials are stored.
- Activity-bar view listing detected AI clients with per-client register and remove.
- Connect and Disconnect commands: register the HostAfrica MCP server with every detected client, or remove it everywhere and clear stored secrets.
- API-token fallback for clients without MCP OAuth support, stored in VS Code SecretStorage; tokens written to other clients' config files get file mode 600.
- Getting-started walkthrough and the HostAfrica brand icon.
- Integration tests against a real VS Code instance (`npm run test:vscode`).

The registrar (shared with the `@hostafrica/connect` CLI) covers nine clients: Claude Code, Cursor, Windsurf, Gemini CLI, Codex CLI, Antigravity, Devin CLI, JetBrains Junie, and Claude Desktop (via an `mcp-remote` bridge). End-to-end browser OAuth verified on VS Code, Claude Code, Codex and Cursor.
