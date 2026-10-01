import { describe, expect, it } from "vitest";
import fastBlockedAt from "../src/index.js";

const yieldTick = () => new Promise((r) => setTimeout(r, 0));

function blockSync(depth: number, blockMs: number): void {
  if (depth !== 64) {
    return blockSync(depth + 1, blockMs);
  }
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

describe("deep recursion", () => {
  it("captures truncated stack", async () => {
    const seen = await new Promise<{ durationMs: number; stack: string }>((resolve) => {
      fastBlockedAt(
        (durationMs, stack) => {
          resolve({ durationMs, stack: stack ?? "" });
        },
        { threshold: 100, interval: 50 },
      );
      blockSync(0, 300);
    });
    expect(seen.durationMs).toBeGreaterThanOrEqual(200);
    const lines = seen.stack.split("\n");
    expect(lines).toHaveLength(32);
    for (const line of lines) {
      expect(line).toMatch(/at blockSync \(.*deep_recursion\.test\.ts:\d+:\d+\)/);
    }
    await yieldTick();
  });
});
