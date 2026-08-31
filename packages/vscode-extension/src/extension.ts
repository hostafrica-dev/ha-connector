import * as vscode from "vscode";
import {
  AuthMode,
  CLIENT_AREA_URL,
  DEVELOPER_DOCS_URL,
  McpClient,
  clientStatuses,
} from "@hostafrica/connector-core";
import { registerMcpProvider } from "./mcpProvider";
import { ClientItem, ClientsTreeProvider } from "./clientsTree";

const TOKEN_SECRET_KEY = "hostafrica.apiToken";

/** Returned from activate so integration tests can assert registration. */
export interface ExtensionApi {
  mcpProviderRegistered: boolean;
}

export function activate(context: vscode.ExtensionContext): ExtensionApi {
  const nativeProviderActive = registerMcpProvider(context);

  const tree = new ClientsTreeProvider(nativeProviderActive);
  context.subscriptions.push(
    vscode.window.createTreeView("hostafricaClients", { treeDataProvider: tree })
  );

  /** OAuth-first: only prompts for a token when the client can't do OAuth. */
  async function authFor(client: McpClient): Promise<AuthMode | undefined> {
    if (client.supportsOAuth) {
      return { kind: "oauth" };
    }
    let token = await context.secrets.get(TOKEN_SECRET_KEY);
    if (!token) {
      token = await promptForToken(context, client.name);
    }
    return token ? { kind: "token", token } : undefined;
  }

  async function registerOne(client: McpClient): Promise<boolean> {
    const auth = await authFor(client);
    if (!auth) return false;
    try {
      await client.register({ auth });
      if (auth.kind === "token") {
        void vscode.window.showWarningMessage(
          `${client.name} doesn't support MCP OAuth yet, so the API token was written to ` +
            `${client.describeTarget()} (file mode 600). You can rotate it in the Client Area.`
        );
      }
      return true;
    } catch (err) {
      void vscode.window.showErrorMessage(
        `HostAfrica: could not register with ${client.name}: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  async function pickClient(filter: (s: { registered: boolean }) => boolean): Promise<McpClient | undefined> {
    const statuses = (await clientStatuses()).filter((s) => s.installed && filter(s));
    if (statuses.length === 0) {
      void vscode.window.showInformationMessage("HostAfrica: no matching clients detected.");
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      statuses.map((s) => ({
        label: s.client.name,
        description: s.client.supportsOAuth ? "OAuth" : "API token",
        client: s.client,
      })),
      { placeHolder: "Choose an AI client" }
    );
    return picked?.client;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("hostafrica.connectAll", async () => {
      const detected = (await clientStatuses()).filter((s) => s.installed);
      let count = 0;
      for (const { client } of detected) {
        if (await registerOne(client)) count++;
      }
      tree.refresh();
      const nativeNote = nativeProviderActive ? " VS Code Copilot is registered natively." : "";
      void vscode.window.showInformationMessage(
        `HostAfrica: registered with ${count} client${count === 1 ? "" : "s"}.${nativeNote} ` +
          `OAuth clients will ask you to sign in via the browser on first use.`
      );
    }),

    vscode.commands.registerCommand("hostafrica.disconnectAll", async () => {
      const statuses = (await clientStatuses()).filter((s) => s.registered);
      for (const { client } of statuses) {
        try {
          await client.unregister();
        } catch (err) {
          void vscode.window.showErrorMessage(
            `HostAfrica: could not remove from ${client.name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      await context.secrets.delete(TOKEN_SECRET_KEY);
      tree.refresh();
      const openArea = "Open Client Area";
      const choice = await vscode.window.showInformationMessage(
        "HostAfrica: removed from all clients and cleared the stored token. " +
          "You can revoke OAuth grants or rotate tokens in the Client Area.",
        openArea
      );
      if (choice === openArea) {
        void vscode.env.openExternal(vscode.Uri.parse(CLIENT_AREA_URL));
      }
    }),

    vscode.commands.registerCommand("hostafrica.registerClient", async (item?: ClientItem) => {
      const client = item?.status.client ?? (await pickClient((s) => !s.registered));
      if (!client) return;
      if (await registerOne(client)) tree.refresh();
    }),

    vscode.commands.registerCommand("hostafrica.unregisterClient", async (item?: ClientItem) => {
      const client = item?.status.client ?? (await pickClient((s) => s.registered));
      if (!client) return;
      await client.unregister();
      tree.refresh();
    }),

    vscode.commands.registerCommand("hostafrica.setToken", async () => {
      await promptForToken(context);
    }),

    vscode.commands.registerCommand("hostafrica.clearToken", async () => {
      await context.secrets.delete(TOKEN_SECRET_KEY);
      void vscode.window.showInformationMessage("HostAfrica: stored API token cleared.");
    }),

    vscode.commands.registerCommand("hostafrica.openClientArea", () =>
      vscode.env.openExternal(vscode.Uri.parse(CLIENT_AREA_URL))
    ),

    vscode.commands.registerCommand("hostafrica.openDocs", () =>
      vscode.env.openExternal(vscode.Uri.parse(DEVELOPER_DOCS_URL))
    ),

    vscode.commands.registerCommand("hostafrica.refresh", () => tree.refresh())
  );

  return { mcpProviderRegistered: nativeProviderActive };
}

async function promptForToken(
  context: vscode.ExtensionContext,
  forClient?: string
): Promise<string | undefined> {
  const token = await vscode.window.showInputBox({
    title: forClient
      ? `${forClient} needs an API token (no MCP OAuth support yet)`
      : "HostAfrica API token",
    prompt: `Generate a token in the Client Area (${CLIENT_AREA_URL}). Stored in VS Code's encrypted SecretStorage.`,
    password: true,
    ignoreFocusOut: true,
  });
  if (token && token.trim()) {
    await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
    return token.trim();
  }
  return undefined;
}

export function deactivate(): void {}
