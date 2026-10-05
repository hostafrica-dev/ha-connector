import { build } from "esbuild";

// Bundle the extension together with @hostafrica/connector-core so `vsce
// package --no-dependencies` works despite the npm-workspaces layout.
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  // Prefer ESM builds: jsonc-parser's UMD `main` hides its internal requires
  // inside a factory, which esbuild can't follow, so they'd fail at runtime.
  mainFields: ["module", "main"],
  target: "node20",
  sourcemap: true,
});
