import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

/**
 * Runs one validation command and always reports the outcome as data.
 *
 * A non-zero exit is a result, not an error: it is the single most useful thing
 * this tool can tell a caller, so it must survive into the report rather than
 * aborting the run. The promise rejects only if the command could not be
 * represented at all, which in practice `exec` does not do — a missing binary
 * still arrives here as an error object and becomes a failed result.
 */
export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join("\n").trimEnd();

      if (!error) {
        resolve({ command, status: "passed", output, exitCode: 0 });
        return;
      }

      resolve({
        command,
        status: "failed",
        // A command that fails without writing anything still needs a reason.
        output: output || error.message,
        exitCode: typeof error.code === "number" ? error.code : null,
      });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
