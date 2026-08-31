#!/usr/bin/env node
import {
  AuthMode,
  CLIENT_AREA_URL,
  clientById,
  clientStatuses,
  McpClient,
} from "@hostafrica/connector-core";

const HELP = `HostAfrica Connect — register the HostAfrica MCP server with your AI tools.

Usage:
  hostafrica-connect status                 Show detected clients and registration state
  hostafrica-connect install [client...]    Register with the given clients (default: all detected)
  hostafrica-connect uninstall [client...]  Remove the registration (default: all registered)

Options:
  --token <token>   API token for clients without OAuth support
                    (or set HOSTAFRICA_API_TOKEN). OAuth-capable clients
                    never need this — they sign in via the browser.

Clients: claude-code, cursor, windsurf, gemini-cli, codex, antigravity,
         devin-cli, junie, claude-desktop
         (claude-desktop bridges via npx mcp-remote and needs Node installed)
Tokens are generated in the Client Area: ${CLIENT_AREA_URL}`;

function parseArgs(argv: string[]) {
  const args = [...argv];
  let token: string | undefined = process.env.HOSTAFRICA_API_TOKEN;
  const tokenIdx = args.indexOf("--token");
  if (tokenIdx !== -1) {
    token = args[tokenIdx + 1];
    if (!token) fail("--token requires a value");
    args.splice(tokenIdx, 2);
  }
  const [command, ...ids] = args;
  return { command, ids, token };
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function authFor(client: McpClient, token: string | undefined): AuthMode {
  if (client.supportsOAuth) return { kind: "oauth" };
  if (!token) {
    fail(
      `${client.name} does not support MCP OAuth yet, so it needs an API token.\n` +
        `Generate one in the Client Area (${CLIENT_AREA_URL}) and pass --token <token> ` +
        `or set HOSTAFRICA_API_TOKEN.`
    );
  }
  return { kind: "token", token };
}

async function resolveTargets(ids: string[], installedOnly: boolean): Promise<McpClient[]> {
  if (ids.length > 0) {
    return ids.map((id) => {
      const client = clientById(id);
      if (!client) fail(`unknown client "${id}" — run \`hostafrica-connect status\` for the list`);
      return client;
    });
  }
  const statuses = await clientStatuses();
  return statuses.filter((s) => (installedOnly ? s.installed : s.registered)).map((s) => s.client);
}

async function main() {
  const { command, ids, token } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "status": {
      const statuses = await clientStatuses();
      for (const { client, installed, registered } of statuses) {
        const state = !installed ? "not detected" : registered ? "registered" : "detected";
        const auth = client.supportsOAuth ? "oauth" : "token";
        console.log(
          `${client.id.padEnd(12)} ${state.padEnd(14)} auth=${auth.padEnd(6)} ${client.describeTarget()}`
        );
      }
      return;
    }

    case "install": {
      const targets = await resolveTargets(ids, true);
      if (targets.length === 0) fail("no clients detected — pass client ids explicitly");
      let failures = 0;
      for (const client of targets) {
        const auth = authFor(client, token);
        try {
          await client.register({ auth });
        } catch (err) {
          failures++;
          console.error(`✘ ${client.name}: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
        const how =
          auth.kind === "oauth"
            ? "OAuth — sign in via the browser on first use"
            : "API token (bearer)";
        console.log(`✔ ${client.name}: registered (${how})`);
        if (auth.kind === "token") {
          console.log(`  note: the token is stored in ${client.describeTarget()} — file mode 600.`);
        }
      }
      if (failures > 0) process.exit(1);
      return;
    }

    case "uninstall": {
      const targets = await resolveTargets(ids, false);
      if (targets.length === 0) {
        console.log("nothing to remove — no registered clients found");
        return;
      }
      let failures = 0;
      for (const client of targets) {
        try {
          await client.unregister();
          console.log(`✔ ${client.name}: removed`);
        } catch (err) {
          failures++;
          console.error(`✘ ${client.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (failures > 0) process.exitCode = 1;
      console.log(
        `If you used an API token, you can rotate or revoke it in the Client Area: ${CLIENT_AREA_URL}`
      );
      return;
    }

    default:
      console.log(HELP);
      process.exit(command === undefined || command === "help" ? 0 : 1);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
