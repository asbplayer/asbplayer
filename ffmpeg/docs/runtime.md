# Using the FFmpeg runtime

The current runtime exposes inspection and links only `libavutil`. Media features should add the FFmpeg components, typed worker operations, native IO, and real-WASM tests they need. See [building and verifying FFmpeg](build.md) for developing a candidate, and [releasing and selecting a runtime](release.md) for choosing the app's published version.

## Browser integration

Use `createWebFfmpegSession` from [`client/src/services/ffmpeg.ts`](../../client/src/services/ffmpeg.ts). Create a session for the lifetime of the feature that owns it:

```ts
const owner = new AbortController();
const session = createWebFfmpegSession({
    signal: owner.signal,
});
// Wire the feature's Cancel action to owner.abort().
try {
    const runtime = await session.load();
    const info = await runtime.inspect();
    // Use the runtime within this feature's lifetime.
} finally {
    session.dispose();
}
```

## Loading and cancellation

A session obtains a verified compressed archive through the [download and cache flow](caching.md). On each load, [runtime-archive.ts](../src/runtime-archive.ts) decompresses it with the browser's `DecompressionStream` and extracts the worker, core module, and WASM with a minimal ustar reader; releases pin `tar --format=ustar`. [assets.ts](../src/assets.ts) creates disposable Blob URLs from those bytes for execution.

This works before service-worker control and when persistent storage is unavailable. Unpacking takes milliseconds compared to WASM compilation and media work. A Content Security Policy must allow Blob workers, module imports, and WASM fetches.

The owner's signal or `dispose()` stops shared downloads and terminates the worker, including synchronous native work. Disposal/failure releases executable URLs. Create a fresh session to retry. A signal passed to `load({ signal })` or `inspect({ signal })` cancels only that caller's wait. Initialization has no timeout.

## Reading input files

[`createInputReader(fileOrBlob)`](../src/input-reader.ts) provides synchronous worker-side random access through bounded slices, with a 64 KiB default maximum per read. It preserves safe integer offsets above 4 GiB, clips reads at EOF, and rejects invalid ranges without copying the entire file into WASM. Native IO adapters, codecs, and job queues belong to future features that need them.

## From feature requests to native FFmpeg

1. **Load and own the session.** [client/src/services/ffmpeg.ts](../../client/src/services/ffmpeg.ts) composes the worker factory and asset preparation. [session.ts](../src/session.ts) starts that preparation and the worker, manages pending requests and cancellation, and releases resources when the session ends.
2. **Initialize the worker.** [worker.ts](../src/worker.ts) validates requests and calls `handleInitialize()` to import the core module, instantiate WASM, and create the native bridge. It returns runtime information so the session can check its identity before becoming ready.
3. **Dispatch operations.** Feature requests pass through the session using message types from [protocol.ts](../src/protocol.ts). The worker validates session identity and dispatches operations. Substantial operations get handler functions in `worker.ts`; request validation, replies, and error handling remain centralized.
4. **Call native code and reply.** [native.ts](../src/native.ts) owns JavaScript/WASM interop and calls the C API declared in [asb_ffmpeg.h](../native/include/asb_ffmpeg.h), implemented by [runtime.cpp](../native/runtime.cpp). The worker sends the result or error back, and the session resolves or rejects the feature's pending Promise.
