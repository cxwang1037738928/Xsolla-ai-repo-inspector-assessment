import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = join(projectRoot, "node_modules", ".bin", "tsx");
const serverEntry = join(projectRoot, "src", "mcp-server.ts");

export type ToolResult = {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

type Pending = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Minimal stdio JSON-RPC client. We drive the real server process rather than
 * importing the handler, because several defects live in the wiring between
 * the declared tool schema and the handler.
 */
export class McpTestClient {
  private child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, Pending>();
  /** Anything the server writes to stdout that is not valid JSON-RPC. */
  readonly stdoutNoise: string[] = [];

  constructor(cwd: string = projectRoot) {
    this.child = spawn(`"${tsxBin}"`, [`"${serverEntry}"`], {
      cwd,
      shell: true,
    }) as ChildProcessWithoutNullStreams;

    this.child.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      let newline: number;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (line) this.handleLine(line);
      }
    });
  }

  private handleLine(line: string): void {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      this.stdoutNoise.push(line);
      return;
    }
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) {
      entry.reject(new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`));
    } else {
      entry.resolve(message.result);
    }
  }

  private request(method: string, params: unknown, timeoutMs = 30_000): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  private notify(method: string, params: unknown): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async connect(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "inspector-test-client", version: "1.0.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async listTools(): Promise<any> {
    return this.request("tools/list", {});
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<ToolResult> {
    return this.request("tools/call", { name, arguments: args }, timeoutMs);
  }

  /** Convenience: the concatenated text of a tool result. */
  static text(result: ToolResult): string {
    return (result.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");
  }

  close(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Client closed"));
    }
    this.pending.clear();
    this.child.kill();
  }
}

/** Starts a connected client, runs `fn`, and always shuts the server down. */
export async function withMcpServer<T>(
  fn: (client: McpTestClient) => Promise<T>,
  cwd?: string,
): Promise<T> {
  const client = new McpTestClient(cwd);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    client.close();
  }
}
