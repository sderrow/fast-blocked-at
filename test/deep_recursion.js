const fastBlockedAt = require("../index.js");
const t = require("tap");
const yield = () => new Promise((r) => setTimeout(r, 0));

function blockSync(depth, blockMs) {
  if (depth !== 64) {
    return blockSync(depth + 1, blockMs);
  }
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

t.test("deep recursion stack works", async (tt) => {
  tt.plan(4);
  fastBlockedAt(
    (durationMs, stack) => {
      tt.ok(durationMs >= 200);
      const lines = stack.split("\n");
      tt.equal(lines.length, 32);
      const expected = Array.from({ length: 32 }).fill(/blockSync/);
      tt.match(lines, expected);
      tt.match(lines, [
        /   at blockSync \(.*\/deep_recursion\.js:10:5\)/,
        /   at blockSync \(.*\/deep_recursion\.js:7:16\)/,
        /   at blockSync \(.*\/deep_recursion\.js:7:16\)/,
      ]);
    },
    {
      threshold: 100,
      interval: 50,
    },
  );
  blockSync(0, 300);
  // Allow the heartbeat to invoke the callback.
  await yield();
});
