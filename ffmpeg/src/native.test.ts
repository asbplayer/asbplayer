import { NativeBridge } from '@project/ffmpeg/native';
import type { NativeModule } from '@project/ffmpeg/native';
import type { FfmpegDiagnostics } from '@project/ffmpeg/protocol';

// The WASM module is the boundary here; real decoding is covered by runtime-audio.mjs.
const nativeModule = (run: (module: NativeModule) => number): NativeModule => {
    const module: NativeModule = {
        HEAPU8: new Uint8Array([1, 2, 3]),
        UTF8ToString: () => 'Native decoder failed',
        _asb_runtime_info_json: () => 0,
        _asb_last_error: () => 0,
        _asb_transcode_audio: () => run(module),
        asbReadInput: undefined,
        asbWriteOutput: undefined,
        asbDiagnostic: undefined,
    };
    return module;
};

const input = { size: 1, readAt: () => new Uint8Array([1]) };

it('buffers recent diagnostics, folds repeats, and bounds both message count and text', () => {
    const reports: FfmpegDiagnostics[] = [];
    const module = nativeModule((module) => {
        for (let index = 0; index < 40; ++index) {
            module.asbDiagnostic!('ffmpeg', 'warning', `warning ${index}`);
        }
        module.asbDiagnostic!('ffmpeg', 'warning', 'warning 39\n');
        module.asbDiagnostic!('ffmpeg', 'warning', 'warning 39');
        module.asbDiagnostic!('runtime', 'trace', 'x'.repeat(2048));
        expect(reports).toEqual([]);
        module.asbWriteOutput!(0, 1);
        return 1;
    });
    expect(
        NativeBridge.create(module).transcodeAudio(
            input,
            0,
            () => {},
            (report) => reports.push(report)
        )
    ).toBe(1);
    expect(reports).toHaveLength(1);
    expect(reports[0].messages).toHaveLength(32);
    expect(reports[0].messages[0].message).toBe('warning 9');
    expect(reports[0].messages.at(-2)).toMatchObject({ message: 'warning 39', occurrences: 3 });
    expect(reports[0].messages.at(-1)?.message).toHaveLength(1024);
    expect(reports[0].omittedMessages).toBe(9);
    expect(module.asbDiagnostic).toBeUndefined();
});

it('keeps diagnostics separate between conversions and ignores a throwing sink on success', () => {
    const reports: FfmpegDiagnostics[] = [];
    let runs = 0;
    const module = nativeModule((module) => {
        if (runs++ === 0) module.asbDiagnostic!('runtime', 'warning', 'Tolerated 2 audio decoder errors');
        module.asbWriteOutput!(0, 1);
        return 1;
    });
    const bridge = NativeBridge.create(module);
    const onDiagnostics = (report: FfmpegDiagnostics) => {
        reports.push(report);
        throw new Error('Logging failed');
    };
    expect(bridge.transcodeAudio(input, 0, () => {}, onDiagnostics)).toBe(1);
    expect(bridge.transcodeAudio(input, 0, () => {}, onDiagnostics)).toBe(1);
    expect(reports[0].messages).toHaveLength(1);
    expect(reports[1]).toEqual({ messages: [], omittedMessages: 0 });
});

it.each(['return error', 'trap'])('preserves diagnostics and the original %s when logging fails', (failure) => {
    const trap = new Error('WASM trapped');
    const module = nativeModule((module) => {
        module.asbDiagnostic!('ffmpeg', 'error', 'Invalid audio bitstream');
        if (failure === 'trap') throw trap;
        return -1;
    });
    const reports: FfmpegDiagnostics[] = [];
    const convert = () =>
        NativeBridge.create(module).transcodeAudio(
            input,
            0,
            () => {},
            (report) => {
                reports.push(report);
                throw new Error('Logging failed');
            }
        );
    expect(convert).toThrow(failure === 'trap' ? trap : 'Native decoder failed');
    expect(reports).toEqual([
        {
            messages: [{ source: 'ffmpeg', level: 'error', message: 'Invalid audio bitstream', occurrences: 1 }],
            omittedMessages: 0,
        },
    ]);
    expect(module.asbDiagnostic).toBeUndefined();
    expect(module.asbReadInput).toBeUndefined();
    expect(module.asbWriteOutput).toBeUndefined();
});
