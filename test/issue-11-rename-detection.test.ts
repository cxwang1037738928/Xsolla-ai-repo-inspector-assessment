/**
 * Issue 11 — renames produce one corrupt row.
 *
 * `--name-status` emits `R100<TAB>old<TAB>new` for a rename. src/git.ts takes
 * only the first field as the status code and rejoins everything else as the
 * path, so the report shows a single entry whose path contains a literal tab,
 * mislabelled "modified" because R100 matches neither "A" nor "D".
 *
 * Required fix: parse the status code by its letter (R/C carry a similarity
 * score and a second path), add "renamed" to the ChangedFile union with an
 * optional previousPath, and prefer `-z` NUL-delimited output so no path can
 * contain a delimiter.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 11: rename detection", () => {
  it("never emits a path containing a tab", () => {
    const files = changedFiles(repo);

    for (const file of files) {
      expect(file.path).not.toContain("\t");
    }
  });

  it("reports the destination path of a rename", () => {
    const paths = changedFiles(repo).map((file) => file.path);

    expect(paths).toContain("renamed.txt");
  });

  it("does not label a rename as a modification", () => {
    const renamed = changedFiles(repo).find((file) => file.path === "renamed.txt");

    expect(renamed).toBeDefined();
    expect(String(renamed?.status)).not.toBe("modified");
  });

  it("still classifies plain additions and modifications correctly", () => {
    const files = changedFiles(repo);

    expect(files.find((file) => file.path === "b.txt")?.status).toBe("added");
    expect(files.find((file) => file.path === "a.txt")?.status).toBe("modified");
  });
});
