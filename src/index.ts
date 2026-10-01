import nodeGypBuild from "node-gyp-build";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export type BlockageSample = {
  executionAsyncId: number | null;
  capturedAtNs: bigint;
};

export type BlockageCallback = (
  durationMs: number,
  stack: string | null,
  sample: BlockageSample,
) => void;

export type BlockageOptions = {
  threshold: number;
  interval: number;
};

type Addon = {
  startWatchdog: (callback: BlockageCallback, interval: number, threshold: number) => boolean;
  heartbeat: () => void;
};

const packageRoot =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const addon = nodeGypBuild(path.join(packageRoot, "..")) as Addon;

export default function fastBlockedAt(callback: BlockageCallback, options: BlockageOptions): void {
  const { interval, threshold } = options;
  if (typeof callback !== "function") {
    throw new TypeError("callback must be a function");
  }
  if (typeof interval !== "number" || interval <= 0 || interval > Number.MAX_SAFE_INTEGER) {
    throw new Error("invalid value for interval");
  }
  if (typeof threshold !== "number" || threshold <= 0 || threshold > Number.MAX_SAFE_INTEGER) {
    throw new Error("invalid value for threshold");
  }
  if (!addon.startWatchdog(callback, interval, threshold)) {
    throw new Error("attempted to start addon twice");
  }
  setInterval(addon.heartbeat, interval).unref();
}
