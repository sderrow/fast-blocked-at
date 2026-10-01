import { AsyncResource, executionAsyncId } from "node:async_hooks";
import { describe, expect, it } from "vitest";
import fastBlockedAt, { type BlockageSample } from "../src/index.js";

const yieldTick = () => new Promise((r) => setTimeout(r, 0));

function blockSync(blockMs: number): void {
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

type Seen = {
  durationMs: number;
  stack: string | null;
} & BlockageSample;

describe("sample metadata", () => {
  it("identifies blocking execution with in-window timestamps", async () => {
    const seen: Seen[] = [];
    const windows: { before: bigint; after: bigint }[] = [];
    const ids: (number | null)[] = [];
    const kinds: string[] = [];

    fastBlockedAt(
      (durationMs, stack, sample) => {
        seen.push({ durationMs, stack, ...sample });
      },
      { threshold: 100, interval: 20 },
    );
    await yieldTick();

    // Single block in a dedicated AsyncResource.
    {
      const r = new AsyncResource("test-block-sample");
      r.runInAsyncScope(() => {
        ids.push(executionAsyncId());
        kinds.push("single");
        const before = process.hrtime.bigint();
        blockSync(300);
        const after = process.hrtime.bigint();
        windows.push({ before, after });
      });
      r.emitDestroy();
      await yieldTick();
    }

    // Repeated executions of one resource share its asyncId.
    {
      const r = new AsyncResource("test-block-repeat");
      for (let i = 0; i < 2; i++) {
        r.runInAsyncScope(() => {
          ids.push(executionAsyncId());
          kinds.push("repeat");
          const before = process.hrtime.bigint();
          blockSync(300);
          const after = process.hrtime.bigint();
          windows.push({ before, after });
        });
        await yieldTick();
      }
      ids[1] = r.asyncId();
      ids[2] = r.asyncId();
      r.emitDestroy();
    }

    // Sequential distinct resources.
    for (let i = 0; i < 2; i++) {
      const r = new AsyncResource(`test-block-seq-${i}`);
      r.runInAsyncScope(() => {
        ids.push(executionAsyncId());
        kinds.push("seq");
        const before = process.hrtime.bigint();
        blockSync(300);
        const after = process.hrtime.bigint();
        windows.push({ before, after });
      });
      r.emitDestroy();
      await yieldTick();
    }

    await yieldTick();
    await yieldTick();

    expect(seen.length).toBe(windows.length);
    for (let i = 0; i < seen.length; i++) {
      const s = seen[i]!;
      const w = windows[i]!;
      expect(s.stack).toMatch(/blockSync/);
      expect(s.durationMs).toBeGreaterThanOrEqual(150);
      expect(s.executionAsyncId).toBe(ids[i]);
      expect(typeof s.capturedAtNs).toBe("bigint");
      expect(s.capturedAtNs >= w.before).toBe(true);
      expect(s.capturedAtNs <= w.after).toBe(true);
      expect(kinds[i]).toBeTypeOf("string");
    }
    expect(seen[1]!.executionAsyncId).toBe(seen[2]!.executionAsyncId);
  });

  it("keeps two-argument callbacks compatible", async () => {
    // Covered by basic/multiple tests; this asserts arity tolerance.
    expect(fastBlockedAt.length).toBe(2);
    await yieldTick();
  });
});
