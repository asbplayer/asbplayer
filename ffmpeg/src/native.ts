import { diagnosticMessageLimit, diagnosticTextLimit } from '@project/ffmpeg/protocol';
import type { FfmpegDiagnostic, FfmpegDiagnostics, FfmpegRuntimeInfo } from '@project/ffmpeg/protocol';
import type { InputReader } from '@project/ffmpeg/input-reader';

export type NativeModule = {
    _asb_runtime_info_json(): number;
    _asb_transcode_audio(inputSize: number, trackIndex: number): number;
    _asb_last_error(): number;
    HEAPU8: Uint8Array;
    UTF8ToString(pointer: number): string;
    asbWriteOutput: ((pointer: number, length: number) => number) | undefined;
    asbReadInput: ((offset: number, pointer: number, length: number) => number) | undefined;
    asbDiagnostic:
        | ((source: FfmpegDiagnostic['source'], level: FfmpegDiagnostic['level'], message: string) => void)
        | undefined;
};

export class NativeBridge {
    private constructor(private readonly module: NativeModule) {}

    static create(module: NativeModule) {
        for (const name of [
            '_asb_runtime_info_json',
            '_asb_transcode_audio',
            '_asb_last_error',
            'UTF8ToString',
        ] as const) {
            if (typeof module[name] !== 'function') throw new Error(`Native export ${name} is missing`);
        }
        if (!(module.HEAPU8 instanceof Uint8Array)) throw new Error('Native heap view is missing');
        return new NativeBridge(module);
    }

    inspect(): FfmpegRuntimeInfo {
        return JSON.parse(this.module.UTF8ToString(this.module._asb_runtime_info_json())) as FfmpegRuntimeInfo;
    }

    transcodeAudio(
        input: InputReader,
        trackIndex: number,
        onChunk: (chunk: ArrayBuffer) => void,
        onDiagnostics: (diagnostics: FfmpegDiagnostics) => void
    ): number {
        let readError: unknown;
        let outputError: unknown;
        let outputBytes = 0;
        const diagnostics: FfmpegDiagnostics = { messages: [], omittedMessages: 0 };
        this.module.asbDiagnostic = (source, level, text) => {
            const message = text.trim().slice(0, diagnosticTextLimit);
            if (message.length === 0) return;
            const previous = diagnostics.messages.at(-1);
            if (previous?.source === source && previous.level === level && previous.message === message) {
                previous.occurrences++;
                return;
            }
            if (diagnostics.messages.length === diagnosticMessageLimit) {
                diagnostics.omittedMessages += diagnostics.messages.shift()!.occurrences;
            }
            diagnostics.messages.push({ source, level, message, occurrences: 1 });
        };
        this.module.asbWriteOutput = (pointer, length) => {
            if (outputError !== undefined) return -1;
            try {
                const chunk = this.module.HEAPU8.slice(pointer, pointer + length).buffer;
                onChunk(chunk);
                outputBytes += length;
                return length;
            } catch (error) {
                outputError = error;
                return -1;
            }
        };
        this.module.asbReadInput = (offset, pointer, length) => {
            try {
                const bytes = input.readAt(offset, length);
                this.module.HEAPU8.set(bytes, pointer);
                return bytes.byteLength;
            } catch (error) {
                readError = error;
                return -1;
            }
        };
        try {
            const result = this.module._asb_transcode_audio(input.size, trackIndex);
            if (readError !== undefined) throw readError;
            if (outputError !== undefined) throw outputError;
            if (!Number.isFinite(result) || result <= 0) {
                throw new Error(this.module.UTF8ToString(this.module._asb_last_error()));
            }
            if (outputBytes === 0) throw new Error('FFmpeg produced an empty audio output');
            return result;
        } finally {
            this.module.asbReadInput = undefined;
            this.module.asbWriteOutput = undefined;
            this.module.asbDiagnostic = undefined;
            try {
                onDiagnostics(diagnostics);
            } catch {
                // Diagnostics must not replace a conversion result or its original failure.
            }
        }
    }
}
