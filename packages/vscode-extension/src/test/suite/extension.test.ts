import * as assert from "node:assert";
import * as vscode from "vscode";
import type { ExtensionApi } from "../../extension";

const EXTENSION_ID = "hostafrica.connector";

suite("HostAfrica Connector", () => {
  test("extension is present and activates cleanly", async () => {
    const ext = vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found in the test host`);
    await ext.activate();
    assert.ok(ext.isActive, "extension did not report active after activate()");
  });

  test("native MCP definition provider registered (VS Code 1.101+ API)", async () => {
    const ext = vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID)!;
    const api = await ext.activate();
    const lm = vscode.lm as unknown as Record<string, unknown>;
    assert.equal(
      typeof lm["registerMcpServerDefinitionProvider"],
      "function",
      "vscode.lm.registerMcpServerDefinitionProvider missing — test host older than 1.101?"
    );
    assert.equal(
      api.mcpProviderRegistered,
      true,
      "activate() reported the MCP provider as not registered"
    );
  });

  test("all commands are registered", async () => {
    await vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID)!.activate();
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "hostafrica.connectAll",
      "hostafrica.disconnectAll",
      "hostafrica.registerClient",
      "hostafrica.unregisterClient",
      "hostafrica.setToken",
      "hostafrica.clearToken",
      "hostafrica.openClientArea",
      "hostafrica.openDocs",
      "hostafrica.refresh",
    ]) {
      assert.ok(commands.includes(id), `command ${id} not registered`);
    }
  });

  test("tree view resolves client rows without throwing", async () => {
    await vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID)!.activate();
    // The refresh command exercises the tree provider's data path.
    await vscode.commands.executeCommand("hostafrica.refresh");
  });
});
