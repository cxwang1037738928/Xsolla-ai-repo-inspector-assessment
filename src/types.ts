export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
};

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  /** Merged stdout and stderr, in the order the command produced them. */
  output: string;
  /** Null when the command could not be started, or was killed by a signal. */
  exitCode?: number | null;
};

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: string[];
  format?: ReportFormat;
};

export type ReportFormat = "markdown" | "json";

export type ReviewResult = {
  report: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};