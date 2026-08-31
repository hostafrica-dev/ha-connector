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
  target: "node20",
  sourcemap: true,
});
