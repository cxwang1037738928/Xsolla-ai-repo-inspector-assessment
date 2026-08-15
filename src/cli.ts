#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { runReview } from "./core.js";
import type { ReportFormat } from "./types.js";

type Args = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format?: ReportFormat;
  validations: string[];
};

const USAGE =
  "Usage: inspector review --repo <path> [--base-ref <ref>] [--validate <command>] [--format markdown|json]";

const OUTPUT_FILENAMES: Record<ReportFormat, string> = {
  markdown: "review-report.md",
  json: "review-report.json",
};

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", validations: [] };
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--repo") {
      args.repositoryPath = argv[++index]?.split(" ")[0];
    } else if (token === "--base-ref") {
      args.baseRef = argv[++index];
    } else if (token === "--format") {
      const value = argv[++index];
      if (value !== "markdown" && value !== "json") {
        throw new Error(`Unsupported --format ${JSON.stringify(value ?? "")}. Expected "markdown" or "json".`);
      }
      args.format = value;
    } else if (token === "--validate") {
      args.validations.push(argv[++index]);
    }
  }
  return args;
}

async function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (args.command !== "review" || !args.repositoryPath) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const format: ReportFormat = args.format ?? "markdown";
  const { report, validationResults } = await runReview({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    format,
  });

  const outputPath = OUTPUT_FILENAMES[format];
  writeFileSync(outputPath, report, "utf8");
  console.log(`Review report written to ${outputPath}`);

  // A failing validation is a finding, not a tool error: the report is always
  // written, and the exit code lets CI gate on the result.
  const failed = validationResults.filter((result) => result.status === "failed");
  if (failed.length > 0) {
    console.error(
      `${failed.length} of ${validationResults.length} validation command(s) failed:`,
    );
    for (const result of failed) {
      console.error(`  - ${result.command}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
