# Using the FFmpeg runtime

The runtime executes media operations in a dedicated browser worker through a small JavaScript/WASM bridge. Its compiled capabilities are recorded in the runtime manifest and exposed by `inspect()`. See [building and verifying FFmpeg](build.md) for developing a candidate and [releasing and selecting a runtime](release.md) for choosing the app's published version.

## Version compatibility

Each asbplayer release selects one specific FFmpeg runtime version and loads only that version. A feature that requires a new runtime version can change the runtime API without supporting older runtime versions; update the selected runtime for the corresponding asbplayer release.

The worker and its request/reply protocol are shipped together in that selected runtime. Communication between them, and other messages confined to one asbplayer version, does not need backward compatibility with earlier versions. Keep validation for malformed messages, stale sessions, and incorrect runtime selection; those checks protect the current protocol rather than support older ones. Backward compatibility generally matters for messages exchanged between the asbplayer app and extension, and for persisted data formats of released features.

## Browser integration

Shared UI receives a host interface for each operation. FFmpeg imports, runtime metadata, and session creation belong in website-loaded adapters, keeping shared UI usable in the extension without loading the runtime. The website adapters in [`client/src/services/ffmpeg.ts`](../../client/src/services/ffmpeg.ts) compose the worker factory, verified asset preparation, and diagnostic logging, creating and disposing a separate session for each audio conversion or subtitle extraction.

An adapter creates a session with `createFfmpegSession` from `@project/ffmpeg`. Supply `workerFactory`, `prepareAssets`, and `onDiagnostics` callbacks as defined by [`CreateFfmpegSessionOptions`](../src/session.ts), and dispose the session when its work completes or fails:

```ts
import { createFfmpegSession } from '@project/ffmpeg';

const owner = new AbortController();
// Wire the feature's Cancel action to owner.abort().
const session = createFfmpegSession({
    workerFactory,
    prepareAssets,
    onDiagnostics,
    signal: owner.signal,
});
try {
    const runtime = await session.load();
    const info = await runtime.inspect();
    // Invoke the required runtime operations within this lifetime.
} finally {
    session.dispose();
}
```

## Loading and cancellation

A session obtains a verified compressed archive through the [download and cache flow](caching.md). On each load, [runtime-archive.ts](../src/runtime-archive.ts) decompresses it with the browser's `DecompressionStream` and extracts the worker, core module, and WASM with a minimal ustar reader; releases pin `tar --format=ustar`. [assets.ts](../src/assets.ts) creates disposable Blob URLs from those bytes for execution.

This works before service-worker control and when persistent storage is unavailable. A Content Security Policy must allow Blob workers, module imports, and WASM fetches.

The owner's signal or `dispose()` stops shared downloads and terminates the worker, including synchronous native work. Disposal/failure releases executable URLs. Create a fresh session to retry. A signal passed to `load({ signal })`, `inspect({ signal })` or a media operation cancels only that caller's wait; abort the owner to terminate native execution. Initialization has no timeout.

## Reading input files

The [input reader](../src/input-reader.ts) provides synchronous worker-side random access through bounded slices and read-ahead. It supports files larger than 4 GiB without copying the entire file into WASM. Native operations connect this reader to FFmpeg through the AVIO adapters in [`host_io.hpp`](../native/host_io.hpp). Operations can transfer output chunks back to the host while processing continues.

## From feature requests to native FFmpeg

1. **Load and own the session.** [client/src/services/ffmpeg.ts](../../client/src/services/ffmpeg.ts) composes the worker factory and asset preparation. [session.ts](../src/session.ts) starts that preparation and the worker, manages pending requests and cancellation, and releases resources when the session ends.
2. **Initialize the worker.** [worker.ts](../src/worker.ts) validates requests and calls `handleInitialize()` to import the core module, instantiate WASM, and create the native bridge. It returns runtime information so the session can check its identity before becoming ready.
3. **Dispatch operations.** Feature requests pass through the session using message types from [protocol.ts](../src/protocol.ts). The worker validates session identity and dispatches operations. Substantial operations get handler functions in `worker.ts`; request validation, replies, and error handling remain centralized.
4. **Call native code and reply.** [native.ts](../src/native.ts) owns JavaScript/WASM interop and calls the C API declared in [asb_ffmpeg.h](../native/asb_ffmpeg.h), implemented by [runtime.cpp](../native/runtime.cpp). The worker sends the result or error back, and the session resolves or rejects the feature's pending Promise.

The native build compiles `runtime.cpp`, which contains the C exports called by TypeScript and the JavaScript I/O bindings. Private implementation headers separate runtime inspection (`runtime_info.hpp`), error storage and formatting (`error.hpp`), and AVIO adapters (`host_io.hpp`) from individual operations: audio conversion in `audio_transcoder.hpp` and subtitle extraction in `subtitles.hpp`. Each operation owns its FFmpeg resources and processing stages together.
