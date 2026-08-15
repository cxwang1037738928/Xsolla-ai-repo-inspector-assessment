/**
 * Issue 13 — uncommitted work is invisible and "untracked" is unreachable.
 *
 * src/git.ts only ever diffs `base...HEAD`, so staged, unstaged and untracked
 * changes never appear. The "untracked" member of ChangedFile in src/types.ts
 * cannot be produced by any code path. A developer reviewing work in progress —
 * the most common case — gets a confidently empty report.
 *
 * Required fix: combine the committed diff with the working-tree state
 * (`git status --porcelain -z`), label each entry with where it came from, and
 * let the caller choose whether to include the working tree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { cleanup, commitAll, git, makeRepo, write } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
  write(repo, "committed.txt", "v1\n");
  write(repo, "will-modify.txt", "v1\n");
  commitAll(repo, "initial");

  git(repo, "checkout", "-b", "feature");
  write(repo, "committed-on-branch.txt", "branch\n");
  commitAll(repo, "branch work");

  // Work in progress, deliberately not committed.
  write(repo, "will-modify.txt", "v2 unstaged\n");
  write(repo, "staged-new.txt", "staged\n");
  git(repo, "add", "staged-new.txt");
  write(repo, "untracked-new.txt", "untracked\n");
});
afterAll(() => cleanup(repo));

describe("issue 13: working-tree changes", () => {
  it("reports untracked files", () => {
    const untracked = changedFiles(repo).find((file) => file.path === "untracked-new.txt");

    expect(untracked).toBeDefined();
    expect(untracked?.status).toBe("untracked");
  });

  it("reports staged-but-uncommitted additions", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("staged-new.txt");
  });

  it("reports unstaged modifications to tracked files", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("will-modify.txt");
  });

  it("still reports committed branch changes", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("committed-on-branch.txt");
  });

  it("does not list the same path twice", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(new Set(paths).size).toBe(paths.length);
  });
});
