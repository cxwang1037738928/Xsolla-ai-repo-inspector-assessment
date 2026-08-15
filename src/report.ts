import type { ChangedFile, ValidationResult } from "./types.js";

export type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

function describeOutcome(result: ValidationResult): string {
  if (result.status === "passed") return "passed";
  return typeof result.exitCode === "number" ? `failed (exit ${result.exitCode})` : "failed";
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    lines.push(
      `### ${result.command}`,
      "",
      `Status: ${describeOutcome(result)}`,
      "",
      "```",
      result.output,
      "```",
    );
  }
  return lines.join("\n");
}

export function jsonReport(input: ReportInput): string {
  return JSON.stringify(
    {
      repositoryPath: input.repositoryPath,
      changedFiles: input.changedFiles,
      validationResults: input.validationResults,
    },
    null,
    2,
  );
}
