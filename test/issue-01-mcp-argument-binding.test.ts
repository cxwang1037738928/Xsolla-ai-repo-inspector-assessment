/**
 * Issue 1 — MCP tool argument never binds.
 *
 * src/mcp-server.ts declares the input field as `repo_path` but the handler
 * reads `input.repoPath`, so `repositoryPath` is always undefined. git then
 * inherits the server process's own cwd and the caller receives a well-formed,
 * empty report about the wrong repository, with no error.
 *
 * Required fix: name the schema field and the handler property consistently,
 * and drop the `input: any` annotation so zod's inferred type catches this at
 * compile time.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpTestClient, withMcpServer } from "./helpers/mcp.js";
import { cleanup, makeFeatureRepo } from "./helpers/repo.js";

let repo: string;

beforeAll(() => {
  repo = makeFeatureRepo();
});
afterAll(() => cleanup(repo));

describe("issue 1: MCP tool argument binding", () => {
  it("inspects the repository named by the declared argument", async () => {
    const text = await withMcpServer(async (client) => {
      const result = await client.callTool("review_repository", { repoPath: repo });
      return McpTestClient.text(result);
    });

    expect(text).not.toContain("undefined");
    expect(text).toContain(repo);
    expect(text).toContain("b.txt");
  }, 60_000);

  it("does not silently review the server's own working directory", async () => {
    const text = await withMcpServer(async (client) => {
      const result = await client.callTool("review_repository", { repoPath: repo });
      return McpTestClient.text(result);
    });

    // The fixture branch has real changes; an empty "Changed files" section
    // means the handler looked somewhere other than the requested repo.
    const section = text.split("## Changed files")[1] ?? "";
    expect(section.trim().length).toBeGreaterThan(0);
  }, 60_000);

  it("declares every argument the handler actually reads", async () => {
    const tools = await withMcpServer(async (client) => client.listTools());
    const tool = tools.tools.find((t: any) => t.name === "review_repository");
    const properties = Object.keys(tool.inputSchema.properties);

    // The schema and the handler must agree on one spelling; camelCase was
    // chosen so the whole surface matches the core request type.
    expect(properties).toContain("repoPath");
  }, 60_000);
});
