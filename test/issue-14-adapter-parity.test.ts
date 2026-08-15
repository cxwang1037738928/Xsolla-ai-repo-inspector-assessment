/**
 * Issue 14 — the CLI and MCP adapters have already diverged.
 *
 * `format` exists on the CLI (src/cli.ts) but is absent from the MCP tool
 * schema (src/mcp-server.ts), so the two advertised interfaces disagree about
 * what the tool accepts. The README explicitly asks that supported interfaces
 * stay behaviorally consistent.
 *
 * Required fix: derive both adapters from one shared request schema, so an
 * option cannot exist on one surface and silently not the other. Any option
 * intentionally excluded from a surface should be a documented decision, not an
 * accident of two hand-written argument lists.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { McpTestClient, withMcpServer } from "./helpers/mcp.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 14: adapter parity", () => {
  it("exposes the same request options on both surfaces", async () => {
    const tools = await withMcpServer(async (client) => client.listTools());
    const tool = tools.tools.find((t: any) => t.name === "review_repository");
    const properties = Object.keys(tool.inputSchema.properties);

    // The CLI accepts --repo, --base-ref, --validate and --format.
    expect(properties).toContain("baseRef");
    expect(properties).toContain("validationCommands");
    expect(properties).toContain("format");
  }, 60_000);

  it("produces the same report through MCP as through the core API", async () => {
    const direct = await reviewRepository({ repositoryPath: repo });
    const viaMcp = await withMcpServer(async (client) =>
      McpTestClient.text(await client.callTool("review_repository", { repoPath: repo })),
    );

    expect(viaMcp.trim()).toBe(direct.trim());
  }, 60_000);

  it("documents every argument it accepts", async () => {
    const tools = await withMcpServer(async (client) => client.listTools());
    const tool = tools.tools.find((t: any) => t.name === "review_repository");
    const properties: Record<string, any> = tool.inputSchema.properties;

    for (const [name, schema] of Object.entries(properties)) {
      expect(schema.description, `${name} has no description`).toBeTruthy();
    }
  }, 60_000);
});
