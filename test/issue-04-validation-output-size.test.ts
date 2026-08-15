/**
 * Issue 4 — validation output larger than 1 MB kills the run.
 *
 * src/validation.ts uses `exec` with the default `maxBuffer` (1 MB). A verbose
 * test suite exceeds that easily, and the resulting
 * ERR_CHILD_PROCESS_STDIO_MAXBUFFER surfaces as a fatal error with no report:
 * the tool works on a toy repo and dies on a real one.
 *
 * Required fix: raise maxBuffer deliberately and cap the captured output in the
 * tool itself — keep a head/tail window, mark the elision, and never let the
 * size of a child's output decide whether the run succeeds.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runValidations } from "../src/validation.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

const TWO_MB = 'node -e "process.stdout.write(\'x\'.repeat(2 * 1024 * 1024))"';

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 4: large validation output", () => {
  it("survives a command that writes more than 1 MB to stdout", async () => {
    const results = await runValidations([TWO_MB], repo);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  }, 30_000);

  it("truncates rather than discarding, and says that it truncated", async () => {
    const results = await runValidations([TWO_MB], repo);
    const output = results[0].output;

    expect(output.length).toBeGreaterThan(0);
    expect(output.length).toBeLessThan(2 * 1024 * 1024);
    expect(output).toMatch(/truncat|elid|omitted|\.\.\./i);
  }, 30_000);
});
