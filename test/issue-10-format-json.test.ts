/**
 * Issue 10 — `--format json` is parsed, typed, and then ignored.
 *
 * src/cli.ts parses the flag and src/types.ts carries it, but src/core.ts
 * unconditionally calls markdownReport, and src/cli.ts always writes
 * review-report.md. Asking for JSON silently yields Markdown in a .md file.
 *
 * Required fix: honour the format in core (a JSON renderer beside the Markdown
 * one), pick the output filename from the format, and reject unknown format
 * values at parse time instead of casting the string through.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 10: json output format", () => {
  it("returns parseable JSON when json is requested", async () => {
    const output = await reviewRepository({ repositoryPath: repo, format: "json" });

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("returns the same facts as the markdown rendering", async () => {
    const output = await reviewRepository({ repositoryPath: repo, format: "json" });
    const parsed = JSON.parse(output) as {
      changedFiles: Array<{ path: string; status: string }>;
    };

    expect(Array.isArray(parsed.changedFiles)).toBe(true);
    expect(parsed.changedFiles.map((file) => file.path)).toContain("b.txt");
  });

  it("still returns markdown when markdown is requested", async () => {
    const output = await reviewRepository({ repositoryPath: repo, format: "markdown" });

    expect(output).toContain("# Review Report");
    expect(output).toContain("## Changed files");
  });

  it("defaults to markdown when no format is given", async () => {
    const output = await reviewRepository({ repositoryPath: repo });

    expect(output).toContain("# Review Report");
  });
});
