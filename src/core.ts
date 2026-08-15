import { changedFiles } from "./git.js";
import { jsonReport, markdownReport, type ReportInput } from "./report.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runValidations } from "./validation.js";

/**
 * Runs a review and returns both the rendered report and the facts behind it,
 * so an adapter can act on the outcome (exit codes, follow-up calls) without
 * re-parsing its own output.
 */
export async function runReview(request: ReviewRequest): Promise<ReviewResult> {
  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    request.repositoryPath,
  );

  const input: ReportInput = {
    repositoryPath: request.repositoryPath,
    changedFiles: files,
    validationResults: validations,
  };
  const report = request.format === "json" ? jsonReport(input) : markdownReport(input);

  return { report, changedFiles: files, validationResults: validations };
}

/** Convenience wrapper for callers that only need the rendered report. */
export async function reviewRepository(request: ReviewRequest): Promise<string> {
  const { report } = await runReview(request);
  return report;
}
