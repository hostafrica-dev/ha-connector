import * as vscode from "vscode";
import { ClientStatus, clientStatuses } from "@hostafrica/connector-core";

export class ClientItem extends vscode.TreeItem {
  constructor(public readonly status: ClientStatus) {
    super(status.client.name, vscode.TreeItemCollapsibleState.None);
    const { installed, registered, client } = status;
    this.id = client.id;
    this.contextValue = !installed
      ? "client-notdetected"
      : registered
        ? "client-registered"
        : "client-unregistered";
    this.description = !installed
      ? "not detected"
      : registered
        ? "registered"
        : client.supportsOAuth
          ? "OAuth ready"
          : "needs API token";
    this.iconPath = new vscode.ThemeIcon(
      registered ? "pass-filled" : installed ? "circle-large-outline" : "circle-slash"
    );
    this.tooltip = `${client.name}\n${client.describeTarget()}\nAuth: ${
      client.supportsOAuth ? "OAuth (browser sign-in)" : "API token fallback"
    }`;
  }
}

/** VS Code row: shown first, handled by the native MCP provider, not the registrar. */
class VsCodeItem extends vscode.TreeItem {
  constructor(nativeProviderActive: boolean) {
    super("VS Code (Copilot)", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "vscode-native";
    this.description = nativeProviderActive ? "registered (native)" : "needs VS Code 1.102+";
    this.iconPath = new vscode.ThemeIcon(nativeProviderActive ? "pass-filled" : "warning");
    this.tooltip = nativeProviderActive
      ? "Registered through the MCP server definition API — OAuth sign-in happens in Copilot Chat."
      : "This VS Code build does not expose the MCP server definition API yet.";
  }
}

export class ClientsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly nativeProviderActive: boolean) {}

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const statuses = await clientStatuses();
    return [
      new VsCodeItem(this.nativeProviderActive),
      ...statuses.map((s) => new ClientItem(s)),
    ];
  }
}
