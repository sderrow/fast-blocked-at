const fastBlockedAt = require("../index.js");
const t = require("tap");
const { AsyncResource, executionAsyncId } = require("async_hooks");

const yieldTick = () => new Promise((r) => setTimeout(r, 0));
function blockSync(blockMs) {
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

t.test("sample metadata", async (tt) => {
  const seen = [];
  const windows = [];
  const ids = [];
  const expectedKinds = [];

  fastBlockedAt(
    (durationMs, stack, sample) => {
      seen.push({ durationMs, stack, ...sample });
    },
    { threshold: 100, interval: 20 },
  );
  await yieldTick();

  // 1. Single block in a dedicated AsyncResource.
  {
    const r = new AsyncResource("test-block-sample");
    r.runInAsyncScope(() => {
      ids.push(executionAsyncId());
      expectedKinds.push("single");
      const before = process.hrtime.bigint();
      blockSync(300);
      const after = process.hrtime.bigint();
      windows.push({ before, after });
    });
    r.emitDestroy();
    await yieldTick();
  }

  // 2. Repeated executions of one resource.
  {
    const r = new AsyncResource("test-block-repeat");
    for (let i = 0; i < 2; i++) {
      r.runInAsyncScope(() => {
        ids.push(executionAsyncId());
        expectedKinds.push("repeat");
        const before = process.hrtime.bigint();
        blockSync(300);
        const after = process.hrtime.bigint();
        windows.push({ before, after });
      });
      await yieldTick();
    }
    // All repeat executions share the resource's asyncId.
    ids[1] = r.asyncId();
    ids[2] = r.asyncId();
    r.emitDestroy();
  }

  // 3. Sequential distinct resources.
  for (let i = 0; i < 2; i++) {
    const r = new AsyncResource(`test-block-seq-${i}`);
    r.runInAsyncScope(() => {
      ids.push(executionAsyncId());
      expectedKinds.push("seq");
      const before = process.hrtime.bigint();
      blockSync(300);
      const after = process.hrtime.bigint();
      windows.push({ before, after });
    });
    r.emitDestroy();
    await yieldTick();
  }

  // Allow final heartbeat to deliver.
  await yieldTick();
  await yieldTick();

  tt.equal(seen.length, windows.length, `one callback per blockage (${seen.length})`);
  for (let i = 0; i < seen.length; i++) {
    tt.match(seen[i].stack, /blockSync/, `block ${i} stack preserved`);
    tt.ok(seen[i].durationMs >= 150, `block ${i} duration measures delay (${seen[i].durationMs})`);
    tt.equal(seen[i].executionAsyncId, ids[i], `block ${i} id matches (${expectedKinds[i]})`);
    tt.ok(
      typeof seen[i].capturedAtNs === "bigint" &&
        seen[i].capturedAtNs >= windows[i].before &&
        seen[i].capturedAtNs <= windows[i].after,
      `block ${i} timestamp within execution window`,
    );
  }
  // Repeat executions share an ID; sequential ones differ (distinct resources).
  tt.equal(
    seen[1].executionAsyncId,
    seen[2].executionAsyncId,
    "repeat executions share resource id",
  );
  tt.end();
});
