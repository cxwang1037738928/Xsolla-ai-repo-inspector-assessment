import { exec, spawn, type ExecOptions } from "node:child_process";
import type { ValidationResult } from "./types.js";

/**
 * Per-command wall-clock budget. Long enough for a typical unit-test or lint
 * run, short enough that a hung command cannot block an MCP caller forever.
 */
export const DEFAULT_TIMEOUT_MS = 120_000;

export type ValidationOptions = {
  /** Overrides DEFAULT_TIMEOUT_MS for this command. */
  timeoutMs?: number;
};

/**
 * Kills the command and everything it started.
 *
 * The direct child is a shell; the work happens in its grandchildren (npm ->
 * node -> workers). Killing only the shell leaves those running, still holding
 * ports and CPU after the call has returned.
 */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;

  if (process.platform === "win32") {
    // taskkill /T is the only reliable way to reach a shell's descendants here.
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => {
      // The tree is already gone, or taskkill is unavailable. Nothing to do.
    });
    return;
  }

  try {
    // Negative pid targets the process group, which `detached` gave the child.
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already exited.
    }
  }
}

/**
 * Runs one validation command and always reports the outcome as data.
 *
 * A non-zero exit is a result, not an error: it is the single most useful thing
 * this tool can tell a caller, so it must survive into the report rather than
 * aborting the run. The promise rejects only if the command could not be
 * represented at all, which in practice `exec` does not do — a missing binary
 * still arrives here as an error object and becomes a failed result.
 *
 * Known limitation: `exec` buffers output in memory and caps it at 1 MiB. A
 * command that exceeds that is killed and reported as failed even if it would
 * have exited zero. Measured for context: this repo's own `npm test` produces
 * ~125 KB, so the ceiling sits well above realistic runs.
 */
export function runValidation(
  command: string,
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    // `detached` is forwarded to spawn at runtime but is missing from
    // @types/node's ExecOptions, so it is widened here rather than cast away.
    const execOptions: ExecOptions & { detached?: boolean } = {
      cwd,
      windowsHide: true,
      // Gives the child its own process group so killTree can take the group
      // down. On Windows this would detach the console instead, and taskkill
      // walks the tree by pid anyway.
      detached: process.platform !== "win32",
    };

    const child = exec(
      command,
      execOptions,
      (error, stdout, stderr) => {
        if (timer) clearTimeout(timer);
        const output = [stdout, stderr].filter(Boolean).join("\n").trimEnd();

        if (timedOut) {
          resolve({
            command,
            status: "failed",
            output: [output, `Command timed out after ${timeoutMs}ms and was killed.`]
              .filter(Boolean)
              .join("\n\n"),
            exitCode: null,
          });
          return;
        }

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
      },
    );

    timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
  options: ValidationOptions = {},
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd, options));
  }
  return results;
}
