import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Runs git in `cwd` and returns stdout. Throws on non-zero exit. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Creates an isolated temp repo with a deterministic identity, so tests never
 * depend on the developer's global git config or default-branch setting.
 */
export function makeRepo(defaultBranch = "main"): string {
  const dir = mkdtempSync(join(tmpdir(), "inspector-test-"));
  git(dir, "init", "-b", defaultBranch);
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Inspector Test");
  git(dir, "config", "commit.gpgsign", "false");
  return dir;
}

export function write(dir: string, relativePath: string, content: string): void {
  const target = join(dir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

export function commitAll(dir: string, message: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-m", message);
}

/**
 * The standard fixture: a `main` commit, then a `feature` branch that modifies
 * one file, adds another, and renames a third.
 */
export function makeFeatureRepo(defaultBranch = "main"): string {
  const dir = makeRepo(defaultBranch);
  write(dir, "a.txt", "hello\n");
  write(dir, "rename-me.txt", "stable contents\n");
  commitAll(dir, "initial");

  git(dir, "checkout", "-b", "feature");
  write(dir, "a.txt", "hello, changed\n");
  write(dir, "b.txt", "brand new\n");
  git(dir, "mv", "rename-me.txt", "renamed.txt");
  commitAll(dir, "feature work");
  return dir;
}

export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
