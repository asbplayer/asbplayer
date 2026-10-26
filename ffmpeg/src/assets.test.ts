import { createFfmpegObjectUrls } from '@project/ffmpeg';

it('creates executable URLs from the prepared bytes and releases them idempotently', async () => {
    const assets = createFfmpegObjectUrls({
        worker: new Blob(['worker']),
        core: new Blob(['core']),
        wasm: new Blob([new Uint8Array([0, 97, 115, 109])]),
    });
    expect(await (await fetch(assets.workerURL)).text()).toBe('worker');
    expect(await (await fetch(assets.coreURL)).text()).toBe('core');
    const wasm = await fetch(assets.wasmURL);
    expect(wasm.headers.get('Content-Type')).toBe('application/wasm');
    expect([...new Uint8Array(await wasm.arrayBuffer())]).toEqual([0, 97, 115, 109]);
    assets.dispose();
    assets.dispose();
    for (const url of [assets.workerURL, assets.coreURL, assets.wasmURL]) await expect(fetch(url)).rejects.toThrow();
});
