import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Inspect the compiled bridge rather than copying its declared capabilities into the manifest. */
export const inspectRuntime = async (root) => {
    const bytes = await readFile(resolve(root, 'ffmpeg-core.wasm'));
    const { default: createRuntime } = await import(pathToFileURL(resolve(root, 'ffmpeg-core.js')).href);
    let memory;
    const runtime = await createRuntime({
        instantiateWasm(imports, receiveInstance) {
            const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports);
            memory = Object.values(instance.exports).find((value) => value instanceof WebAssembly.Memory);
            receiveInstance(instance);
            return {};
        },
    });
    if (!memory) throw new Error('The FFmpeg runtime does not export memory.');
    return {
        info: JSON.parse(runtime.UTF8ToString(runtime._asb_runtime_info_json())),
        memory: {
            initialBytes: memory.buffer.byteLength,
            shared: typeof SharedArrayBuffer !== 'undefined' && memory.buffer instanceof SharedArrayBuffer,
        },
    };
};
