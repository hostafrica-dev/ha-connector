import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Locate a binary on PATH (`which` on POSIX, `where` on Windows). */
export async function whichBin(bin: string): Promise<string | undefined> {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await execFileP(finder, [bin]);
    const first = stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
    return first?.trim();
  } catch {
    return undefined;
  }
}

export async function readTextIfPresent(p: string): Promise<string | undefined> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Write a config file that may contain a bearer token: parent dirs created,
 * mode 600 so other local users can't read it. The mode option on writeFile
 * only applies to newly created files, so chmod explicitly for existing ones
 * (no-op semantics on Windows, where fs permissions work differently).
 */
export async function writePrivate(p: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") {
    await fs.chmod(p, 0o600);
  }
}

export { execFileP };
