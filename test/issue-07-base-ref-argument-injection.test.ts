/**
 * Issue 7 — the base ref is argument injection into git.
 *
 * src/git.ts interpolates the caller's ref into an argv slot with no `--`
 * separator, so a value starting with a dash is parsed by git as a *flag*.
 * `--base-ref "--output=pwned.txt"` makes git write a file into the target
 * repository. execFileSync prevents shell injection, not git flag injection —
 * and over MCP this value is model-controlled.
 *
 * Required fix: validate the ref against a conservative pattern (reject a
 * leading dash), pass revisions after a `--` separator, and prefer an explicit
 * `git rev-parse --verify` of the resolved ref before diffing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { changedFiles } from "../src/git.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 7: base ref argument injection", () => {
  it("rejects a base ref that would be parsed as a git flag", () => {
    expect(() => changedFiles(repo, "--output=pwned.txt")).toThrow();
  });

  it("does not let a crafted base ref write files into the repository", () => {
    try {
      changedFiles(repo, "--output=pwned.txt");
    } catch {
      // Rejection is the desired path.
    }
    const entries = readdirSync(repo);

    expect(entries.filter((name) => name.startsWith("pwned"))).toHaveLength(0);
  });

  it("rejects other dash-prefixed refs regardless of the flag used", () => {
    expect(() => changedFiles(repo, "--exit-code")).toThrow();
    expect(() => changedFiles(repo, "-z")).toThrow();
  });

  it("still accepts ordinary refs, including ones with slashes and dots", () => {
    expect(() => changedFiles(repo, "main")).not.toThrow();
    expect(() => changedFiles(repo, "HEAD~1")).not.toThrow();
  });
});
