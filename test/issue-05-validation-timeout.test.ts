/**
 * Issue 5 — no timeout, so a hanging command hangs the caller forever.
 *
 * src/validation.ts passes no `timeout` to `exec`. A command that waits on
 * stdin, starts a server, or hits a credential prompt never returns. Over MCP
 * this is worse than a crash: the tool call blocks indefinitely with no cancel
 * path and the agent simply stops.
 *
 * Required fix: enforce a default per-command timeout (overridable), kill the
 * child and its process group on expiry, and report the outcome as a normal
 * failed ValidationResult that says it timed out.
 *
 * The fixture self-terminates after 8s so a failing run cannot leak a process.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runValidations } from "../src/validation.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

const SLEEPS_8_SECONDS = 'node -e "setTimeout(() => {}, 8000)"';
const CAP_MS = 3_000;

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 5: validation timeout", () => {
  it("settles a long-running command instead of hanging", async () => {
    const outcome = await Promise.race([
      runValidations([SLEEPS_8_SECONDS], repo).then(
        () => "settled" as const,
        () => "settled" as const,
      ),
      new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), CAP_MS)),
    ]);

    expect(outcome).toBe("settled");
  }, 20_000);

  it("reports a timeout as a failed result, not a thrown error", async () => {
    const results = await runValidations([SLEEPS_8_SECONDS], repo).catch(() => null);

    expect(results).not.toBeNull();
    expect(results?.[0].status).toBe("failed");
    expect(results?.[0].output).toMatch(/timed out|timeout/i);
  }, 20_000);
});
