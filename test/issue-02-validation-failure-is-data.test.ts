/**
 * Issue 2 — a failing validation destroys the run instead of being reported.
 *
 * src/validation.ts rejects the promise on any non-zero exit, so the rejection
 * propagates through core.ts to the CLI's catch-all: the user gets a Node stack
 * trace and no report file at all. The `status: "failed"` member declared in
 * src/types.ts is unreachable.
 *
 * Required fix: treat a non-zero exit as a normal outcome — resolve with
 * `status: "failed"`, capture stdout+stderr and the exit code, and reserve
 * rejection for cases where the command could not be run at all.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { runValidations } from "../src/validation.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

const FAILING = 'node -e "console.log(\'boom output\'); process.exit(1)"';
const PASSING = 'node -e "console.log(\'ok\')"';

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 2: validation failure is reported as data", () => {
  it("resolves with status 'failed' rather than rejecting", async () => {
    const results = await runValidations([FAILING], repo);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
  });

  it("keeps the failing command's output, which is the reason to run it", async () => {
    const results = await runValidations([FAILING], repo);

    expect(results[0].output).toContain("boom output");
  });

  it("still runs later commands after an earlier one fails", async () => {
    const results = await runValidations([FAILING, PASSING], repo);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("failed");
    expect(results[1].status).toBe("passed");
  });

  it("still produces a full report when a validation fails", async () => {
    const report = await reviewRepository({
      repositoryPath: repo,
      validationCommands: [FAILING],
    });

    expect(report).toContain("## Changed files");
    expect(report).toContain("b.txt");
    expect(report).toContain("boom output");
  });
});
