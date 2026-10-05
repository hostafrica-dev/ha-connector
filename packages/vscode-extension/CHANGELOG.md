# Changelog

## 1.0.3

Ships the Windows hardening that 1.0.2 missed, makes API tokens work from the CLI, and stops config writes from disturbing the rest of the file.

- The 1.0.2 extension bundled connector-core 1.0.0 from npm instead of the workspace copy, so the Windows ACL hardening listed under 1.0.2 did not ship in it. It does now, and CI fails if a workspace package pins a stale version of another.
- CLI: `--token` (also `--token=<token>`, or `HOSTAFRICA_API_TOKEN`) now registers with the bearer endpoint as documented. Previously it was ignored because every client supports OAuth. `status` shows which mode `install` would use.
- Config edits change only the HostAfrica entry: comments, indentation and other servers in JSON (including JSONC) configs are kept, and Codex's `config.toml` keeps its comments and layout.
- Writes are atomic (temp file, then rename), symlinked configs are written through to their target, and OAuth-only writes no longer change an existing file's permissions.
- Extension: removing a client reports errors instead of failing silently, **Disconnect** says when some removals failed, and the sidebar names the right minimum VS Code version (1.101).
- New CLI test suite; the `docs/` copies of the package READMEs are checked against the shipped ones in CI.

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
