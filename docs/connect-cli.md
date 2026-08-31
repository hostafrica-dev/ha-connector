# @hostafrica/connect

Register the HostAfrica [remote MCP server](https://modelcontextprotocol.io/) with every AI tool on your machine, in one command.

Nothing runs locally. The MCP server is HostAfrica's hosted endpoint (`https://mcp.hostafrica.com/mcp`), so connecting a tool means writing one entry into that tool's config file. This CLI detects which tools you have and writes that entry for each.

```bash
npx @hostafrica/connect install
```

Once connected, you can ask your assistant to *list my VPS servers*, *reboot web-01*, *add an A record for app.mydomain.co.za*, *snapshot db-01 before I deploy*, or *is mydomain.africa available?* Around 72 tools are live: VPS lifecycle, backups and snapshots, firewall, rDNS, power tasks, monitoring, DNS and DNSSEC, domains, and catalogue/orders/payments.

## Install

Run it directly, or install it globally for a shorter command:

```bash
npm install -g @hostafrica/connect
```

Requires Node 18 or newer.

## Commands

```
hostafrica-connect status                 Show detected clients and registration state
hostafrica-connect install [client...]    Register with the given clients (default: all detected)
hostafrica-connect uninstall [client...]  Remove the registration (default: all registered)
```

With no client ids, `install` targets every client it detects and `uninstall` targets every client currently registered. Pass ids to be specific:

```bash
hostafrica-connect install claude-code cursor
```

`status` prints one line per client: whether it's detected, whether HostAfrica is registered, which auth mode it will use, and where the registration lives:

```
claude-code  registered      auth=oauth   claude mcp (user scope)
cursor       detected        auth=oauth   /Users/you/.cursor/mcp.json
codex        not detected    auth=oauth   /Users/you/.codex/config.toml
```

### Options

| Option | Purpose |
|---|---|
| `--token <token>` | API token for clients that can't run OAuth. Also read from `HOSTAFRICA_API_TOKEN`. |

OAuth-capable clients never need a token; they open the browser themselves on first use.

## Supported clients

`claude-code`, `cursor`, `windsurf`, `gemini-cli`, `codex`, `antigravity`, `devin-cli`, `junie`, `claude-desktop`

Each writes to that tool's own config location and format: `claude mcp add` for Claude Code, TOML for Codex CLI, `serverUrl` for Windsurf and Antigravity, `httpUrl` for Gemini CLI, and so on. Claude Desktop's config file only accepts stdio servers, so it's bridged through `npx mcp-remote` and needs Node available at runtime.

VS Code isn't in this list: the [companion extension](https://github.com/hostafrica-dev/ha-connector/tree/main/packages/vscode-extension) registers the server natively through VS Code's `McpServerDefinitionProvider` API instead of writing a config file. That extension can also drive this same registrar for every other detected tool, if you'd rather click than type.

## Authentication

Registrations carry no credentials. They point at the OAuth endpoint, and your tool runs the browser sign-in itself. The endpoint supports Dynamic Client Registration, PKCE and refresh tokens. The grant is scoped to your account and revocable at any time in the [Client Area](https://panel.hostafrica.com/).

For the rare client that can't run OAuth, generate an API token in the Client Area and pass `--token`. Config files containing a token are written `chmod 600`. Registration is read-modify-write, so entries for other MCP servers in the same file are preserved.

## Links

- [Source and issues](https://github.com/hostafrica-dev/ha-connector)
- [`@hostafrica/connector-core`](https://www.npmjs.com/package/@hostafrica/connector-core): the registrar library this wraps
- [Developer docs](https://www.hostafrica.com/developers/)
- [HostAfrica Client Area](https://panel.hostafrica.com/)

MIT licensed.
