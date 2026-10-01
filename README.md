# fast-blocked-at

Detect event loop blockages and get a stack trace; fast enough for production.

## Note

This is a nearly unchanged fork of kvakil's [fast-blocked-at](https://git.sr.ht/~kvakil/fast-blocked-at), with help from watershed-climate. The major difference is using `-std=c++2a` instead of `-std=c++20`.

## Installation

```
npm install @sderrow/fast-blocked-at
```

(Tested with Node.js 22 & 24)

## Prebuild

Use [prebuildify](https://github.com/prebuild/prebuildify) to pre-build the binaries so the native module doesn't have to be built on demand. This is helpful if python is not available in your build environment.

This package uses raw V8, so each Node major needs its own binary. Build with `--napi=false` to get ABI-tagged files (Node 22 = abi127, Node 24 = abi137), one per platform/arch, each built on that OS:

```
prebuildify -t 22.22.3 --napi=false --arch arm64 --platform darwin --strip
prebuildify -t 24.21.0 --napi=false --arch arm64 --platform darwin --strip
# run these two on linux/amd64:
prebuildify -t 22.22.3 --napi=false --arch x64 --platform linux --strip
prebuildify -t 24.21.0 --napi=false --arch x64 --platform linux --strip
```

This yields `prebuilds/darwin-arm64/fast-blocked-at.abi127.node`, `.abi137.node`, and the same pair under `prebuilds/linux-x64/`. `node-gyp-build` picks the matching ABI; a missing ABI falls back to source build instead of loading the wrong binary.

## Usage

```javascript
const blocked = require("@sderrow/fast-blocked-at");
blocked(
  (durationMs, stack, sample) => {
    console.log(`Blocked for ${durationMs}ms:\n${stack}`);
    console.log(`Captured in async resource ${sample.executionAsyncId} at ${sample.capturedAtNs}`);
  },
  {
    // Frequency with which the event loop is checked in ms
    // (Report event loop blockages which have taken longer than this)
    threshold: 200 /* milliseconds */,
    // How often to "heartbeat" to the "watchdog" (see below)
    // Lower values use more resources but makes it more accurate
    interval: 50 /* milliseconds */,
  },
);
```

TypeScript:

```typescript
import blocked, { type BlockageSample } from "@sderrow/fast-blocked-at";
blocked(
  (durationMs: number, stack: string | null, sample: BlockageSample) => {
    console.log(`Blocked for ${durationMs}ms:\n${stack}`);
  },
  { threshold: 200, interval: 50 },
);
```

The callback receives three arguments: `durationMs`, `stack`, and
`sample`. Existing two-argument callbacks remain compatible; the third
argument is additive.

`sample` is `{ executionAsyncId, capturedAtNs }`:

- `executionAsyncId` is the `async_hooks.executionAsyncId()` active when
  the stack was captured, or `null` when no execution context was
  available (async ID `0`). Use it to associate the sampled stack with
  the specific callback execution that was running while blocked.
- `capturedAtNs` is a `bigint` nanosecond timestamp taken alongside the
  stack. It shares the clock used by Node's `process.hrtime.bigint()`,
  so it can be compared directly against `process.hrtime.bigint()`
  values recorded around the blocking work.

Note that `durationMs` still measures heartbeat delay (how late the
heartbeat ran), while `sample` identifies the execution whose stack was
captured. Delivery is delayed until the event loop unblocks.

## Description

This module sets a timer which runs every `interval` milliseconds on the
event loop. A separate "watchdog" thread is started which polls every
`threshold` milliseconds. If the event loop has been blocked for longer
than `threshold` milliseconds (i.e., since the last watchdog poll), then
a stack trace is captured and the callback will be invoked when the
event loop is unblocked.

This differs from [blocked-at][ba] in two important ways:

1. It is low-overhead and so suitable for production use.
2. It captures the stack trace somewhere between `threshold` and `2 *
threshold` milliseconds after the start of the event loop cycle,
   unlike blocked-at which tries to get the stack trace at the "start"
   of the blockage.

While we currently just capture a stack trace, future versions of this package
may include more advanced functionality like automatically starting the CPU
profiler.

[ba]: https://github.com/naugtur/blocked-at
