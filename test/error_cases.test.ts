import { describe, expect, it } from "vitest";
import fastBlockedAt from "../src/index.js";

const never = () => {
  throw new Error("should not be called");
};

function mustFail(options: unknown, pattern: string): void {
  expect(() => fastBlockedAt(never, options as { threshold: number; interval: number })).toThrow(
    pattern,
  );
}

describe("error cases", () => {
  it("rejects invalid options and callback", () => {
    mustFail({ interval: 100, threshold: 0 }, "threshold");
    mustFail({ interval: 0, threshold: 100 }, "interval");
    mustFail({ interval: "foo", threshold: 100 }, "interval");
    mustFail({}, "interval");
    mustFail({ interval: 100, threshold: "foo" }, "threshold");
    const tooLarge = Number.MAX_SAFE_INTEGER * 2;
    mustFail({ interval: tooLarge, threshold: 100 }, "interval");
    mustFail({ interval: 100, threshold: tooLarge }, "threshold");
    expect(() =>
      fastBlockedAt("foo" as unknown as () => void, {
        interval: 100,
        threshold: 200,
      }),
    ).toThrow("callback");
  });
});
