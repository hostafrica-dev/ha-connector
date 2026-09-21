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
 * readable by the owning user only. On POSIX that is mode 600; the mode
 * option on writeFile only applies to newly created files, so chmod
 * explicitly for existing ones. On Windows mode bits are a no-op, so the
 * file gets an explicit NTFS ACL instead (see restrictAclToCurrentUser).
 */
export async function writePrivate(p: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, { encoding: "utf8", mode: 0o600 });
  if (process.platform === "win32") {
    await restrictAclToCurrentUser(p);
  } else {
    await fs.chmod(p, 0o600);
  }
}

/**
 * Windows equivalent of chmod 600: drop inherited ACEs and grant full
 * control to the current user only. Files under the profile folder already
 * inherit an owner/SYSTEM/Administrators ACL, so this mostly matters when
 * that folder has been loosened or the config lives on a share. Failures
 * are swallowed: the file is already written and a missing icacls (or a
 * filesystem without ACLs) should not break registration.
 */
export async function restrictAclToCurrentUser(p: string): Promise<void> {
  if (process.platform !== "win32") return;
  const domain = process.env.USERDOMAIN;
  const user = process.env.USERNAME;
  if (!user) return;
  const principal = domain ? `${domain}\\${user}` : user;
  try {
    // /inheritance:r drops inherited ACEs, /grant:r replaces the user's
    // explicit ACE, and /remove:g strips the broad groups that could remain
    // as explicit entries: Everyone, Authenticated Users, Users (by SID so
    // it is locale-independent). SYSTEM and Administrators may remain; that
    // is parity with root on POSIX.
    await execFileP("icacls", [
      p,
      "/inheritance:r",
      "/grant:r",
      `${principal}:F`,
      "/remove:g",
      "*S-1-1-0",
      "*S-1-5-11",
      "*S-1-5-32-545",
    ]);
  } catch {
    /* best effort */
  }
}

export { execFileP };
