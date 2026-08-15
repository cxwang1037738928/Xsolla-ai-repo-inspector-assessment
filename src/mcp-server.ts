#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

/**
 * Declared once and passed to server.tool, so the handler's argument type is
 * inferred from this shape. Annotating the handler parameter as `any` is what
 * previously allowed the schema and the handler to disagree about a field name
 * without any compile-time complaint.
 */
const reviewInput = {
  repoPath: z.string().describe("Path to the repository root to inspect."),
  baseRef: z
    .string()
    .optional()
    .describe("Ref to diff against. Defaults to the repository's default branch."),
  validationCommands: z
    .array(z.string())
    .optional()
    .describe("Commands to run inside the repository, e.g. \"npm test\"."),
};

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report.",
  reviewInput,
  async (input) => {
    const report = await reviewRepository({
      repositoryPath: input.repoPath,
      baseRef: input.baseRef,
      validationCommands: input.validationCommands,
    });
    return { content: [{ type: "text", text: report }] };
  },
);

await server.connect(new StdioServerTransport());
