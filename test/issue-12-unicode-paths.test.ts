/**
 * Issue 12 — non-ASCII paths come back quoted and octal-escaped.
 *
 * git quotes unusual paths by default (core.quotePath), so a file named
 * café.ts is reported as "caf\303\251.ts" — surrounded by literal quotes, with
 * the UTF-8 bytes escaped. That string cannot be handed to any subsequent file
 * operation, which is exactly what an agent would do with it next.
 *
 * Required fix: pass `-z` for NUL-delimited, unquoted output (or set
 * `-c core.quotePath=false`) and decode as UTF-8.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { cleanup, commitAll, git, makeRepo, write } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
  write(repo, "seed.txt", "seed\n");
  commitAll(repo, "initial");

  git(repo, "checkout", "-b", "feature");
  write(repo, "café.ts", "export const x = 1;\n");
  write(repo, "docs/naïve-guide.md", "# hello\n");
  write(repo, "a file with spaces.txt", "spaces\n");
  commitAll(repo, "unicode and spaces");
});
afterAll(() => cleanup(repo));

describe("issue 12: non-ASCII and unusual paths", () => {
  it("returns the real UTF-8 path, not an octal-escaped one", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("café.ts");
  });

  it("does not wrap paths in literal quote characters", () => {
    for (const file of changedFiles(repo)) {
      expect(file.path.startsWith('"')).toBe(false);
      expect(file.path).not.toContain("\\3");
    }
  });

  it("handles nested non-ASCII paths and paths containing spaces", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("docs/naïve-guide.md");
    expect(paths).toContain("a file with spaces.txt");
  });
});
