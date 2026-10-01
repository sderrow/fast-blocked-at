import { describe, expect, it } from "vitest";
import fastBlockedAt from "../src/index.js";

describe("starting twice", () => {
  it("throws on second start", () => {
    fastBlockedAt(() => {}, { threshold: 100, interval: 50 });
    expect(() => fastBlockedAt(() => {}, { threshold: 100, interval: 50 })).toThrow("twice");
  });
});
