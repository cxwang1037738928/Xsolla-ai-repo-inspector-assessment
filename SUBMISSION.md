# Submission

## What did you investigate first, and why?
The user use case. I needed to know what the overall user experience looked like before I made any changes or started looking for bugs. I asked Claude to give me an overview of what a user interacting with the repo would look like, as well checked the pre-existing test. 
## What did you choose to implement or fix?
The fixes I implemented were the following:
1. In mcp-server.ts, the schema declared repo_path but the handler read repoPath. It is now repoPath in both
2. Before the fix, a non-zero exit just rejected instead of returning a result. The validation.ts now resolves it as failed with merged output and an exit code; rejection is reserved for a command that cannot run.
3. Added a 120-second timeout in validation.ts; no timeout existed before, and a hung command blocked an MCP call forever.
4. The code took in JSON format but always defaulted to generating Markdown, so I changed it to generate JSON as well.
## What did you intentionally not do?
I intentionally left 9 bugs that Claude had identified unresolved because I didn't have time to look over them and challenge Claude on its claims.
## Interface decision

- Decision: CLI-first / MCP-first / hybrid
- Primary user and execution environment:
- Trust boundary and allowed capabilities:
- Reliability, discoverability, latency/context, and output tradeoffs:
- How supported interfaces remain consistent:
- Evidence that would change this decision:

## How did you use an AI coding agent?
First, I asked Claude to give me a rundown of the repo in concise terms, as well as what a user use case would look like. Then, after I had read through its overview and the existing code, I asked Claude to find and generate a list of possible bugs present in the code, but in my prompt I specified that every single claim that Claude makes must have a citation to a section of code in the repo. This allowed me to identify the most obvious issues(for example, the schema and handler used snake_case vs. camelCase). 

After the possible bugs were discovered. I asked Claude to generate a testing script for each of the issues under the test directory and skimmed them. Then I ran the code to make sure that the bugs were actually present, and asked Claude to include a markdown file in the test directory detailing all the possible bugs.

Lastly, after identifying the changes I wanted Claude to make, I asked it to implement fixes while giving me suggestions on what the fix should be and to ask for my input on every single change to the repo before changing any code. This allowed me to choose and familiarize myself with the changes, and minimized the chance of rogue changes to my database.
## Where did you check, correct, or reject an AI suggestion? (required)
One of the bugs Claude reported was that exec's default 1MiB maxBuffer meant "Any verbose test suite dies with ERR_CHILD_PROCESS_STDIO_MAXBUFFER", and it proceeded to propose raising the max buffer ceiling to 64 MB. I pushed back on this because at the time I had no idea what the buffer was for, how likely it was to be breached, and whether anything already handled the overflow. I then looked at the code again, and it turns out that an earlier fix(fix number 2 in the list above) already made every exec error resolve as a failed result, so an overflow no longer aborts the run. Because of this, I asked Claude to write a script that probs the buffer, and it was a success; 900 KB passes while 1.1 MB is labelled failed with a null exit code.
## Commands used to verify the result, with outcomes
I ran the following:
  npm run typecheck(clean)
  npm run build(clean)
  npx vitest run(25 passing 23 failed by design)
Some tests were meant to fail, as they were for problems that Claude had discovered but not manually inspected and verified.
## A blocker you hit and how you approached it

## Known limitations and the next three things you would do
I've not tested my changes enough. My testing phase ran test scripts that Claude had written before/after each change to the codebase, but I've not had the opportunity to manually inspect the code thoroughly. Additionally, many of the issues Claude highlighted were unresolved as I did not have the time to verify them, and they remain documented in a .md file in the test directory. The next three things I would do would be:
1. Thoroughly inspect the codespace after my changes as well as the test scripts Claude has written
2. Read through the list of bugs and manually verify each one
3. Implement fixes and add more tests to ensure that no subsequent fix causes issues that propagate to other parts of the code, paying attention especially to parts that could fail silently.
## Approximate focused-work time

- Start: 7:35 PM 8/14/2026
- Finish: 9:05 PM 8/14/2026
