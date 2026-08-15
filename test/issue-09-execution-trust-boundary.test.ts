/**
 * Issue 9 — the MCP door hands a model an unrestricted shell.
 *
 * src/validation.ts uses `exec`, which runs its argument through a shell. The
 * MCP tool accepts `validationCommands` from the model with no allowlist, no
 * path restriction and no confirmation, so any client that can call
 * review_repository has arbitrary code execution with the user's privileges.
 *
 * Required fix: decide the trust boundary explicitly and enforce it at the
 * adapter. The default should be that the MCP surface does not accept free-form
 * commands — run a configured set (or discovered package scripts) instead, and
 * gate anything else behind opt-in server configuration rather than model
 * input. Argument arrays with execFile are preferable to shell strings.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { McpTestClient, withMcpServer } from "./helpers/mcp.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 9: execution trust boundary over MCP", () => {
  it("does not execute arbitrary model-supplied shell commands by default", async () => {
    // Forward slashes and single-quoted JS keep this one command portable
    // across cmd.exe and sh; nested double quotes would break under cmd and
    // make the test pass because the payload never ran.
    const marker = join(repo, "rce-marker.txt").replace(/\\/g, "/");
    const command = `node -e "require('fs').writeFileSync('${marker}', 'x')"`;

    await withMcpServer(async (client) => {
      await client
        .callTool("review_repository", { repoPath: repo, validationCommands: [command] })
        .catch(() => undefined);
    });

    expect(existsSync(marker)).toBe(false);
  }, 60_000);

  it("tells the caller why the command was refused rather than failing silently", async () => {
    const result = await withMcpServer(async (client) =>
      client
        .callTool("review_repository", {
          repoPath: repo,
          validationCommands: ['node -e "console.log(1)"'],
        })
        .catch(() => null),
    );

    if (result === null) return; // A protocol-level error is acceptable.
    const text = McpTestClient.text(result);
    expect(text).toMatch(/not permitted|not allowed|disabled|refus|allowlist|configur/i);
  }, 60_000);
});
