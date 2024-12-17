# fast-blocked-at

Detect event loop blockages and get a stack trace; fast enough for production.

## Note

This is a nearly unchanged fork of kvakil's [fast-blocked-at](https://git.sr.ht/~kvakil/fast-blocked-at), with help from watershed-climate. The major difference is using `-std=c++2a` instead of `-std=c++20`.

## Installation

```
yarn add sderrow/fast-blocked-at
```

(Tested with NodeJS 14, 16 & 18.)

## Prebuild

Use [prebuildify](https://github.com/prebuild/prebuildify) to pre-build the binaries so the native module doesn't have to be built on demand. This is helpful if python is not available in your build environment.

Specify the runtime, architecture, and platform as necessary. For example, `prebuildify -t 20.18.1 --arch x64 --platform linux --strip`.

## Usage

```javascript
const blocked = require("fast-blocked-at");
blocked(
  (durationMs, stack) => {
    console.log(`Blocked for ${durationMs}ms:\n${stack}`);
  },
  {
    // Frequency with which the event loop is checked in ms
    // (Report event loop blockages which have taken longer than this)
    threshold: 200 /* milliseconds */,
    // How often to "heartbeat" to the "watchdog" (see below)
    // Lower values use more resources but makes it more accurate
    interval: 50 /* milliseconds */,
  }
);
```

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

## Contributing

We're not accepting contributions at this time.
