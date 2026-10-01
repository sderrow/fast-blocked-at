const fastBlockedAt = require("../index.js");
const t = require("tap");
const yield = () => new Promise((r) => setTimeout(r, 0));

function blockSync(blockMs) {
  const start = Date.now();
  while (Date.now() - start < blockMs);
}

t.test("multiple blockages", async (tt) => {
  tt.plan(6);
  fastBlockedAt(
    (durationMs, stack) => {
      console.log(durationMs);
      tt.ok(durationMs >= 200);
      tt.match(stack, /blockSync/);
    },
    {
      threshold: 100,
      interval: 10,
    },
  );
  blockSync(300);
  await yield();
  blockSync(300);
  await yield();
  blockSync(300);
  await yield();
});
