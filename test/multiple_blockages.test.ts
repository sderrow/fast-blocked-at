import { describe, expect, it } from "vitest";
import fastBlockedAt from "../src/index.js";

const yieldTick = () => new Promise((r) => setTimeout(r, 0));

function blockSync(blockMs: number): void {
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

describe("multiple blockages", () => {
  it("reports each blockage", async () => {
    const seen: { durationMs: number; stack: string | null }[] = [];
    await new Promise<void>((resolve) => {
      let count = 0;
      fastBlockedAt(
        (durationMs, stack) => {
          seen.push({ durationMs, stack });
          count++;
          if (count === 3) resolve();
        },
        { threshold: 100, interval: 10 },
      );
      (async () => {
        blockSync(300);
        await yieldTick();
        blockSync(300);
        await yieldTick();
        blockSync(300);
        await yieldTick();
      })();
    });
    expect(seen).toHaveLength(3);
    for (const { durationMs, stack } of seen) {
      expect(durationMs).toBeGreaterThanOrEqual(200);
      expect(stack).toMatch(/blockSync/);
    }
  });
});
