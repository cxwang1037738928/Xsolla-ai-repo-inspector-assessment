/**
 * Issue 5 — no timeout, so a hanging command hung the caller forever.
 *
 * src/validation.ts passed no timeout, so a command that waited on stdin,
 * started a server, or hit a credential prompt never returned. Over MCP that
 * was worse than a crash: the tool call blocked indefinitely with no cancel
 * path and the agent simply stopped.
 *
 * Fixed: DEFAULT_TIMEOUT_MS (120s) caps every command and is overridable per
 * call. On expiry the whole process tree is killed — the direct child is only
 * a shell, so killing it alone would leave npm's node grandchildren running and
 * still holding their ports — and the outcome is reported as an ordinary failed
 * ValidationResult that says it timed out.
 *
 * These tests pass an explicit short timeout rather than waiting out the real
 * default: the mechanism is what needs proving, and a suite that burned 120s to
 * demonstrate that a default exists would be worthless. A separate assertion
 * covers the default being finite and sane.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TIMEOUT_MS, runValidations } from "../src/validation.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

const SLEEPS_8_SECONDS = 'node -e "setTimeout(() => {}, 8000)"';
const FINISHES_FAST = 'node -e "console.log(\'done\')"';

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 5: validation timeout", () => {
  it("settles a long-running command instead of hanging", async () => {
    const started = Date.now();
    const results = await runValidations([SLEEPS_8_SECONDS], repo, { timeoutMs: 1_000 });

    // Well inside the command's own 8s lifetime, so this can only have
    // returned because the timeout fired.
    expect(Date.now() - started).toBeLessThan(6_000);
    expect(results).toHaveLength(1);
  }, 20_000);

  it("reports a timeout as a failed result, not a thrown error", async () => {
    const results = await runValidations([SLEEPS_8_SECONDS], repo, { timeoutMs: 1_000 });

    expect(results[0].status).toBe("failed");
    expect(results[0].output).toMatch(/timed out|timeout/i);
    expect(results[0].exitCode).toBeNull();
  }, 20_000);

  it("leaves a command that finishes inside its budget alone", async () => {
    const results = await runValidations([FINISHES_FAST], repo, { timeoutMs: 10_000 });

    expect(results[0].status).toBe("passed");
    expect(results[0].output).toContain("done");
    expect(results[0].exitCode).toBe(0);
  }, 20_000);

  it("continues to the next command after one times out", async () => {
    const results = await runValidations([SLEEPS_8_SECONDS, FINISHES_FAST], repo, {
      timeoutMs: 1_000,
    });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("failed");
    expect(results[1].status).toBe("passed");
  }, 20_000);

  it("applies a finite, sane default when no timeout is given", () => {
    expect(Number.isFinite(DEFAULT_TIMEOUT_MS)).toBe(true);
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(600_000);
  });
});
