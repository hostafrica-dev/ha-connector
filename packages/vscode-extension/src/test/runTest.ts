import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main() {
  // out-test/test/runTest.js -> package root
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  // Keep user-data-dir short: VS Code puts a unix socket in it, and macOS
  // caps socket paths at 103 chars (the repo path alone blows past that).
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "havsc-"));
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: ["--disable-extensions", "--user-data-dir", userDataDir],
  });
}

main().catch((err) => {
  console.error("Integration tests failed:", err);
  process.exit(1);
});
