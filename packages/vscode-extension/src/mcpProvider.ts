import * as vscode from "vscode";
import { MCP_OAUTH_URL, SERVER_LABEL } from "@hostafrica/connector-core";

/**
 * Register the HostAfrica MCP server natively with VS Code. OAuth-first: the
 * definition points at the OAuth endpoint with no credentials — VS Code's MCP
 * client implements the MCP authorization spec and drives the browser sign-in
 * itself, so no token ever touches disk or SecretStorage on this path.
 *
 * Stable since VS Code 1.101; guarded so the extension still loads (tree view,
 * CLI-style commands) on older builds.
 */
export function registerMcpProvider(context: vscode.ExtensionContext): boolean {
  const lm = vscode.lm as unknown as {
    registerMcpServerDefinitionProvider?: (id: string, provider: unknown) => vscode.Disposable;
  };
  const McpHttpServerDefinition = (vscode as unknown as Record<string, any>)[
    "McpHttpServerDefinition"
  ];
  if (!lm.registerMcpServerDefinitionProvider || !McpHttpServerDefinition) {
    return false;
  }

  const changeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(changeEmitter);
  context.subscriptions.push(
    lm.registerMcpServerDefinitionProvider("hostafrica.mcp", {
      onDidChangeMcpServerDefinitions: changeEmitter.event,
      provideMcpServerDefinitions: async () => [
        new McpHttpServerDefinition(SERVER_LABEL, vscode.Uri.parse(MCP_OAUTH_URL)),
      ],
      resolveMcpServerDefinition: async (server: unknown) => server,
    })
  );
  return true;
}
