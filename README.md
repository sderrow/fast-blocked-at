# fast-blocked-at

Detect event loop blockages and get a stack trace; fast enough for production.

## Note

This is a nearly unchanged fork of kvakil's [fast-blocked-at](https://git.sr.ht/~kvakil/fast-blocked-at), with help from watershed-climate. The major difference is using `-std=c++2a` instead of `-std=c++20`.

## Requirements

- Node.js 22, 24, or 26 (raw V8 API, so each major needs its own binary)
- Prebuilds are shipped for `darwin-arm64`, `linux-x64`, and `linux-arm64` (ABI 127 for Node 22, ABI 137 for Node 24, ABI 147 for Node 26). On these platforms no build runs at install time; the matching binary is used as-is.
- Other platforms/arches build from source at install time via the bundled `node-gyp`, which needs Python and a C++ toolchain. Without a toolchain the install fails; use `--ignore-scripts` (e.g. `npm install --ignore-scripts`) to skip the build instead, noting that `require()` will throw until a compatible binary is built manually.

## Installation

```
npm install @sderrow/fast-blocked-at
```

```sh
pnpm add @sderrow/fast-blocked-at
```

## Prebuild

Use [prebuildify](https://github.com/prebuild/prebuildify) to pre-build the binaries so the native module doesn't have to be built on demand. This is helpful if python is not available in your build environment.

This package uses raw V8, so each Node major needs its own binary. Build with `--napi=false` to get ABI-tagged files (Node 22 = abi127, Node 24 = abi137, Node 26 = abi147). Run one loop per OS/arch, each on that OS/arch:

```sh
# on macOS (darwin/arm64):
for v in 22.22.3 24.21.0 26.10.0; do
  prebuildify -t $v --napi=false --arch arm64 --platform darwin --strip
done
# on linux/amd64:
for v in 22.22.3 24.21.0 26.10.0; do
  prebuildify -t $v --napi=false --arch x64 --platform linux --strip
done
# on linux/arm64:
for v in 22.22.3 24.21.0 26.10.0; do
  prebuildify -t $v --napi=false --arch arm64 --platform linux --strip
done
```

The `linux/*` loops must run on Linux: a macOS-built binary won't load there, and the arch must match. From macOS the simplest way is Docker (one run per arch, e.g. `--platform linux/amd64` with a `node:26-bookworm` image plus `python3 make g++` and global `prebuildify`/`node-gyp` installs); a native Linux host or CI matrix works just as well.

This yields `prebuilds/{darwin-arm64,linux-x64,linux-arm64}/@sderrow+fast-blocked-at.{abi127,abi137,abi147}.node` (prebuildify's default naming for the scoped package). `node-gyp-build` picks the matching ABI; a missing ABI falls back to source build instead of loading the wrong binary.

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

TypeScript (types are shipped from `dist/index.d.ts`):

```typescript
import blocked, {
  type BlockageCallback,
  type BlockageOptions,
  type BlockageSample,
} from "@sderrow/fast-blocked-at";
blocked(
  (durationMs: number, stack: string | null, sample: BlockageSample) => {
    console.log(`Blocked for ${durationMs}ms:\n${stack}`);
  },
  { threshold: 200, interval: 50 },
);
```

## API

### `fastBlockedAt(callback, options)`

Default export. Starts the watchdog and heartbeat timer. `options`
is `{ threshold, interval }` (both in milliseconds):

- `threshold`: minimum event-loop delay before a blockage is reported.
- `interval`: how often the heartbeat runs. Lower values are more
  accurate but cost more CPU.

Validation:

- `callback` must be a function, otherwise a `TypeError` is thrown.
- `interval` / `threshold` must be numbers `> 0` and
  `<= Number.MAX_SAFE_INTEGER`, otherwise an `Error` naming the bad
  field is thrown.
- The addon can only be started **once per process**. A second call
  throws `Error: attempted to start addon twice`.

The heartbeat uses an `unref()`'d `setInterval`, so it never keeps the
process alive on its own.

### Callback: `(durationMs, stack, sample) => void`

- `durationMs` (`number`): estimated blockage length. This is heartbeat
  delay minus an `interval / 2` bias correction (the delay is expected
  to begin halfway through the polling cycle). It measures how late
  the heartbeat ran, and is delivered once the loop unblocks.
- `stack` (`string | null`): V8 stack captured by the watchdog,
  formatted as `    at fn (file:line:col)` lines, capped at 32 frames.
  `null` only if the stack string could not be constructed.
- `sample` (`BlockageSample`): `{ executionAsyncId, capturedAtNs }`.
  Existing two-argument callbacks keep working; the third argument is
  additive.

`sample` fields:

- `executionAsyncId` (`number | null`) is the
  `async_hooks.executionAsyncId()` active when the stack was captured,
  or `null` when there was no execution context (async ID `0`). Use it
  to associate the sampled stack with the specific callback execution
  that was running while blocked.
- `capturedAtNs` (`bigint`) is a nanosecond timestamp taken alongside
  the stack. It shares the clock used by Node's
  `process.hrtime.bigint()`, so it can be compared directly against
  `process.hrtime.bigint()` values recorded around the blocking work.

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

## Development

This repo uses `pnpm` (v12), TypeScript (built with `tsdown` to CJS
`dist/`), `vitest` for tests, and `oxlint`/`oxfmt` with a Husky +
lint-staged pre-commit hook.

```sh
pnpm install
pnpm build
pnpm test    # builds, then runs vitest
pnpm lint
pnpm format
```
