/**
 * Issue 3 — a non-Git path silently reports the enclosing repository.
 *
 * git walks up the directory tree, so pointing the tool at any directory nested
 * inside a repo returns that repo's diff, labelled with the path the caller
 * asked about. The caller cannot tell the answer is about a different tree.
 *
 * Required fix: verify the path exists and is the root of a work tree (e.g.
 * `git rev-parse --show-toplevel` and compare against the resolved input)
 * before diffing, and throw a clear, actionable error otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedFiles } from "../src/git.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;
let nestedNonRepo: string;
let standaloneNonRepo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
  nestedNonRepo = join(repo, "subdir", "not-a-repo");
  mkdirSync(nestedNonRepo, { recursive: true });
  standaloneNonRepo = mkdtempSync(join(tmpdir(), "inspector-plain-"));
});
afterAll(() => {
  cleanup(repo);
  cleanup(standaloneNonRepo);
});

describe("issue 3: repository path validation", () => {
  it("refuses a directory that is not a repository root", () => {
    expect(() => changedFiles(nestedNonRepo)).toThrow(/repositor/i);
  });

  it("never attributes the parent repository's changes to a nested path", () => {
    let files: ReturnType<typeof changedFiles> = [];
    try {
      files = changedFiles(nestedNonRepo);
    } catch {
      return; // Throwing is the accepted behaviour.
    }
    expect(files.map((file) => file.path)).not.toContain("b.txt");
  });

  it("gives an actionable error for a directory with no repository at all", () => {
    expect(() => changedFiles(standaloneNonRepo)).toThrow(/repositor/i);
  });

  it("gives an actionable error for a path that does not exist", () => {
    expect(() => changedFiles(join(tmpdir(), "inspector-does-not-exist-xyz"))).toThrow(
      /not found|does not exist|no such|repositor/i,
    );
  });
});
