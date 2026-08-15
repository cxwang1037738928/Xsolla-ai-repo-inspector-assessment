/**
 * Issue 6 — the base ref is hard-coded to "main".
 *
 * src/git.ts falls back to `"main"`, which breaks on `master` repositories,
 * forks whose default branch differs, and shallow CI checkouts where the base
 * branch was never fetched. Running the tool in CI is the obvious deployment
 * and it is the environment most likely to hit this.
 *
 * Required fix: resolve the repository's real default branch when no base ref
 * is supplied (origin/HEAD, then init.defaultBranch, then a main/master probe),
 * and when a ref genuinely cannot be resolved, fail with a message naming the
 * ref and how to override it — not a raw git exit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let masterRepo: string;

beforeAll(() => {
  masterRepo = makeFeatureRepo("master");
});
afterAll(() => cleanup(masterRepo));

describe("issue 6: default base ref resolution", () => {
  it("resolves the repository's actual default branch when none is given", () => {
    const files = changedFiles(masterRepo);

    expect(files.map((file) => file.path)).toContain("b.txt");
  });

  it("explains an unresolvable base ref instead of leaking a git error", () => {
    // Naming the ref is not enough — git's own stderr already does that. The
    // message has to tell the caller which knob to turn.
    let message = "";
    try {
      changedFiles(masterRepo, "no-such-branch-xyz");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("no-such-branch-xyz");
    expect(message).toMatch(/--base-ref|base ref|default branch/i);
  });
});
