import { executables } from '@project/ffmpeg/runtime-assets.json';

export const ffmpegExecutables = executables;

export type FfmpegAssetUrls = {
    workerURL: string;
    coreURL: string;
    wasmURL: string;
};

export type PreparedFfmpegAssets = FfmpegAssetUrls & {
    /** Release temporary executable URLs when the session ends. */
    dispose(): void;
};

/** Build executable URLs from prepared bytes, independent of service-worker control or storage. */
export const createFfmpegObjectUrls = (blobs: { worker: Blob; core: Blob; wasm: Blob }): PreparedFfmpegAssets => {
    const urls: string[] = [];
    const dispose = () => {
        for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    };
    const create = (blob: Blob, type: string) => {
        const url = URL.createObjectURL(new Blob([blob], { type }));
        urls.push(url);
        return url;
    };
    try {
        return {
            workerURL: create(blobs.worker, ffmpegExecutables.worker.type),
            coreURL: create(blobs.core, ffmpegExecutables.core.type),
            wasmURL: create(blobs.wasm, ffmpegExecutables.wasm.type),
            dispose,
        };
    } catch (error) {
        dispose();
        throw error;
    }
};
