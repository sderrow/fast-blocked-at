import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = `
const fastBlockedAt = require('${here}/../dist/index.js');
fastBlockedAt(() => {}, {
    threshold: 1 + (Math.random() * 100) | 0,
    interval: 1 + (Math.random() * 100) | 0,
});
function blockSync(blockMs) {
    const start = Date.now();
    while (Date.now() - start < blockMs);
}
blockSync(Math.random() * 200);
if (Math.random() < 0.5) setTimeout(() => {}, Math.random() * 100);
if (Math.random() < 0.5) setTimeout(() => {}, Math.random() * 100);
`;

describe("stress termination", () => {
  it("survives worker termination", async () => {
    for (let i = 0; i < 10; i++) {
      const parallelWorkers = 4;
      await new Promise<void>((resolve) => {
        let done = 0;
        for (let j = 0; j < parallelWorkers; j++) {
          const w = new Worker(script, { eval: true });
          setTimeout(() => {
            w.terminate();
            done++;
            if (done === parallelWorkers) resolve();
          }, Math.random() * 300);
        }
      });
      expect(true).toBe(true);
    }
  }, 60000);
});
