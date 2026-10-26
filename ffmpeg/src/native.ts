import type { FfmpegRuntimeInfo } from '@project/ffmpeg/protocol';

export type NativeModule = {
    _asb_runtime_info_json(): number;
    UTF8ToString(pointer: number): string;
};

export class NativeBridge {
    private constructor(private readonly module: NativeModule) {}

    static create(module: NativeModule) {
        if (typeof module._asb_runtime_info_json !== 'function') {
            throw new Error('Native export _asb_runtime_info_json is missing');
        }
        return new NativeBridge(module);
    }

    inspect(): FfmpegRuntimeInfo {
        return JSON.parse(this.module.UTF8ToString(this.module._asb_runtime_info_json())) as FfmpegRuntimeInfo;
    }
}
