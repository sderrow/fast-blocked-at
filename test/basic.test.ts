import { describe, expect, it } from "vitest";
import fastBlockedAt from "../src/index.js";

const yieldTick = () => new Promise((r) => setTimeout(r, 0));

function blockSync(blockMs: number): void {
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

describe("basic", () => {
  it("reports duration and stack", async () => {
    const seen = await new Promise<{ durationMs: number; stack: string | null }>((resolve) => {
      fastBlockedAt(
        (durationMs, stack) => {
          resolve({ durationMs, stack });
        },
        { threshold: 100, interval: 50 },
      );
      blockSync(300);
    });
    expect(seen.durationMs).toBeGreaterThanOrEqual(200);
    expect(seen.stack).toMatch(/blockSync/);
    await yieldTick();
  });
});
