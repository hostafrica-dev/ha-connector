import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

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

export interface WriteConfigOptions {
  /** The content holds a bearer token: restrict the file to the owning user. */
  secret: boolean;
}

/**
 * Write a client config file atomically: the content goes to a temp file in
 * the same directory, which is then renamed over the target, so a crash
 * mid-write can't leave a truncated config behind. A symlinked config (as
 * dotfile managers create) is written through to its target instead of
 * being replaced by a regular file.
 *
 * With `secret`, the file is readable by the owning user only: mode 600 on
 * POSIX, an explicit NTFS ACL on Windows where mode bits are a no-op (see
 * restrictAclToCurrentUser). Without it, an existing file keeps its mode
 * and a new one gets the default, so OAuth-only writes don't tighten the
 * permissions of a config the user owns.
 */
export async function writeConfigFile(
  p: string,
  content: string,
  opts: WriteConfigOptions
): Promise<void> {
  const target = await resolveSymlink(p);
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  const existingMode = await fs.stat(target).then(
    (s) => s.mode & 0o777,
    () => undefined
  );
  const tmp = path.join(
    dir,
    `.${path.basename(target)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
  );
  try {
    await fs.writeFile(tmp, content, {
      encoding: "utf8",
      mode: opts.secret ? 0o600 : (existingMode ?? 0o666),
      flag: "wx",
    });
    if (opts.secret) {
      if (process.platform === "win32") {
        await restrictAclToCurrentUser(tmp);
      } else {
        await fs.chmod(tmp, 0o600);
      }
    } else if (existingMode !== undefined && process.platform !== "win32") {
      // writeFile's mode is masked by the umask; restore the exact bits.
      await fs.chmod(tmp, existingMode);
    }
    await renameWithRetry(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

/** Follow a symlink to the file it points at; non-links resolve to themselves. */
async function resolveSymlink(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    // Missing file, or a dangling link: write where the link points.
  }
  try {
    if ((await fs.lstat(p)).isSymbolicLink()) {
      return path.resolve(path.dirname(p), await fs.readlink(p));
    }
  } catch {
    /* not there yet */
  }
  return p;
}

/**
 * On Windows, renaming over a file another process briefly holds open (an
 * editor, an indexer, antivirus) fails with EPERM/EBUSY; retry a few times
 * before giving up.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const transient = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (process.platform !== "win32" || !transient || attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
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
