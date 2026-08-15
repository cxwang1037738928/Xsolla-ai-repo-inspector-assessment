# Issue-driven test suite

One file per defect found while investigating the starter. Each test asserts
the **intended** behaviour, so an open issue's test fails and a fixed issue's
test passes. The file header comments carry the diagnosis and the required fix;
this page is the index.

Issues 1, 2 and 10 are fixed and green. Everything else is diagnosed and
reproduced but deliberately left open — the failing tests are the spec.

Shared fixtures live in [`helpers/repo.ts`](helpers/repo.ts) (isolated temp Git
repos) and [`helpers/mcp.ts`](helpers/mcp.ts) (a stdio JSON-RPC client that
drives the real server process, since several defects live in the wiring
between the declared schema and the handler).

## Index

| # | Status | Test file | Bug it hunts | Origin |
|---|---|---|---|---|
| 1 | fixed | `issue-01-mcp-argument-binding` | Schema declared `repo_path`, handler read `repoPath` → path never bound, git ran in the server's own cwd, caller got `# Review Report: undefined` and no error | `src/mcp-server.ts:13,19` |
| 2 | fixed | `issue-02-validation-failure-is-data` | Non-zero exit *rejected* instead of reporting `status: "failed"` → stack trace, no report file. The declared `"failed"` status was unreachable | `src/validation.ts:7-10` |
| 3 | open | `issue-03-non-git-path` | git walks up the tree, so a nested non-repo path silently reports the **enclosing** repo's diff under the requested path | `src/git.ts:11-23` |
| 4 | open | `issue-04-validation-output-size` | `exec`'s default 1 MB `maxBuffer` → any verbose test suite dies with `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` | `src/validation.ts:6` |
| 5 | open | `issue-05-validation-timeout` | No timeout → a hanging command blocks the MCP call forever with no cancel path | `src/validation.ts:6` |
| 6 | open | `issue-06-base-ref-default` | Base ref hard-coded to `"main"` → breaks on `master` repos and shallow CI checkouts | `src/git.ts:12` |
| 7 | open | `issue-07-base-ref-argument-injection` | Ref interpolated into argv with no `--` guard → git parses a dash-prefixed ref as a **flag**; `--output=x` writes an arbitrary file | `src/git.ts:13` |
| 8 | open | `issue-08-report-injection` | Untrusted text interpolated unescaped → validation output can close the code fence and forge whole sections (a fabricated clean `npm audit`); an injection channel into a model's context | `src/report.ts` |
| 9 | open | `issue-09-execution-trust-boundary` | MCP accepts free-form `validationCommands` and runs them through a shell → arbitrary RCE for any client that can call the tool | `src/validation.ts:6` |
| 10 | fixed | `issue-10-format-json` | `--format json` was parsed and typed, then ignored — always Markdown, always `review-report.md` | `src/core.ts:12` |
| 11 | open | `issue-11-rename-detection` | `R100<TAB>old<TAB>new` collapses into one row whose path contains a literal tab, mislabelled "modified" | `src/git.ts:19-21` |
| 12 | open | `issue-12-unicode-paths` | git's default path quoting leaks through as `"caf\303\251.ts"` — unusable for any downstream file operation | `src/git.ts:13` |
| 13 | open | `issue-13-working-tree-changes` | `base...HEAD` sees only committed work → staged/unstaged/untracked changes invisible; `"untracked"` unreachable | `src/git.ts:13`, `src/types.ts:3` |
| 14 | open | `issue-14-adapter-parity` | `format` exists on the CLI but not in the MCP schema → the two advertised interfaces disagree about what the tool accepts | `src/cli.ts` vs `src/mcp-server.ts` |

## Fixes applied

- **1** — the tool schema is a named const passed to `server.tool`, and the
  handler's `input: any` annotation is gone, so zod's inferred type makes any
  future schema/handler disagreement a compile error rather than a silent
  `undefined`. Field names are camelCase across the whole surface.
- **2** — `runValidation` resolves on non-zero exit with `status: "failed"`,
  merged stdout+stderr, and an `exitCode`. Rejection now means only "could not
  run the command". The CLI still writes the report and then exits `1` so it
  can gate CI.
- **10** — `core.runReview` branches on `format`, `jsonReport` sits beside
  `markdownReport`, the CLI rejects unknown `--format` values at parse time,
  and the output filename follows the format.

`exitCode` is optional on `ValidationResult` so hand-built fixtures (including
the original `report.test.ts`) stay terse; every real result sets it.

## Running

```bash
npm test                              # everything
npx vitest run test/issue-02-*        # one issue
npx vitest run test/report.test.ts    # the original starter test
```

Issues 1, 9 and 14 spawn the MCP server over stdio and are the slow ones
(~60s budget each). Issue 5 deliberately waits on a command that
self-terminates after 8s, so a failing run cannot leak a process.

Two tests were tightened after their first run because they passed for the
wrong reason: issue 9's RCE payload used nested double quotes that cmd.exe
never executed, and issue 6's error assertion was satisfied by git's own stderr
merely echoing the ref name.

## Not covered

Report size and reviewable detail — the report lists filenames only, with no
diff content and no size ceiling, and MCP returns it inline as one blob. Raised
during investigation, deliberately left without a test.

The CLI also truncates `--repo` at the first space (`argv[++index]?.split(" ")[0]`
in `src/cli.ts`), so a path like `C:\Program Files\repo` silently becomes
`C:\Program`. Noticed while fixing issue 10, left untouched as out of scope.
