import { SERVER_KEY } from "../constants";
import { AuthMode, McpClient, RegisterOptions, endpointFor } from "../types";
import { execFileP, whichBin } from "../fsutil";

/** Pure builder for the `claude mcp add` argument list — unit-testable. */
export function claudeAddArgs(auth: AuthMode): string[] {
  const { url, headers } = endpointFor(auth);
  const args = ["mcp", "add", "--scope", "user", "--transport", "http", SERVER_KEY, url];
  for (const [k, v] of Object.entries(headers ?? {})) {
    args.push("--header", `${k}: ${v}`);
  }
  return args;
}

/**
 * Claude Code manages its own MCP config; drive it through `claude mcp`
 * rather than editing files, so scope handling stays Claude Code's problem.
 * Registration is user-scoped so it works across every project.
 */
export const claudeCode: McpClient = {
  id: "claude-code",
  name: "Claude Code",
  supportsOAuth: true,
  describeTarget: () => "claude mcp (user scope)",

  async detect() {
    return (await whichBin("claude")) !== undefined;
  },

  async isRegistered() {
    try {
      await execFileP("claude", ["mcp", "get", SERVER_KEY]);
      return true;
    } catch {
      return false;
    }
  },

  async register(opts: RegisterOptions) {
    // `claude mcp add` refuses duplicate names, so make register idempotent.
    await this.unregister();
    await execFileP("claude", claudeAddArgs(opts.auth));
  },

  async unregister() {
    try {
      await execFileP("claude", ["mcp", "remove", "--scope", "user", SERVER_KEY]);
    } catch {
      // already gone
    }
  },
};
