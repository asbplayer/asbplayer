import { expect, it } from '@jest/globals';
import { NativeBridge } from '@project/ffmpeg/native';
import type { NativeModule } from '@project/ffmpeg/native';
import type { FfmpegDiagnostics } from '@project/ffmpeg/protocol';

// The WASM module is the boundary here; runtime-audio.mjs and runtime-subtitles.mjs cover real decoding.
const nativeModule = (run: (module: NativeModule) => number): NativeModule => {
    const module: NativeModule = {
        HEAPU8: new Uint8Array(64),
        UTF8ToString: () => 'Native decoder failed',
        _asb_runtime_info_json: () => 0,
        _asb_last_error: () => 0,
        _asb_transcode_audio: () => run(module),
        _asb_extract_subtitles: () => 0,
        _malloc: () => 0,
        _free: () => {},
        asbReadInput: undefined,
        asbWriteOutput: undefined,
        asbDiagnostic: undefined,
    };
    module.HEAPU8.set([1, 2, 3]);
    return module;
};

const input = { size: 1, readAt: () => new Uint8Array([1]) };

it('passes a uint32 track array and count using the current heap and copies outputs before native memory is reused', () => {
    const module = nativeModule(() => 1);
    const freed: number[] = [];
    module._malloc = (size) => {
        expect(size).toBe(8);
        // Allocation can grow WASM memory and replace the exported heap view.
        module.HEAPU8 = new Uint8Array(64).fill(255);
        return 8;
    };
    module._free = (pointer) => freed.push(pointer);
    const results = [2, 258].map((trackIndex) => ({
        trackIndex,
        extension: 'srt',
        mimeType: 'application/x-subrip',
    }));
    module.UTF8ToString = () => JSON.stringify(results);
    module._asb_extract_subtitles = (size, pointer, count) => {
        expect(size).toBe(input.size);
        expect(count).toBe(2);
        expect([...module.HEAPU8.slice(pointer, pointer + 8)]).toEqual([2, 0, 0, 0, 2, 1, 0, 0]);
        expect(module.asbReadInput!(0, 32, 1)).toBe(1);
        expect(module.HEAPU8[32]).toBe(1);
        module.HEAPU8.set([4, 5], 32);
        expect(module.asbWriteSubtitleOutput!(2, 32, 2)).toBe(2);
        module.HEAPU8.fill(0, 32, 34);
        return 1;
    };
    const chunks: { index: number; bytes: ArrayBuffer }[] = [];
    const output = NativeBridge.create(module).extractSubtitles(
        input,
        [2, 258],
        (index, bytes) => chunks.push({ index, bytes }),
        () => {}
    );
    expect(output).toEqual(results);
    expect(chunks.map(({ index, bytes }) => ({ index, bytes: [...new Uint8Array(bytes)] }))).toEqual([
        { index: 2, bytes: [4, 5] },
    ]);
    expect(freed).toEqual([8]);
    expect(module.asbReadInput).toBeUndefined();
    expect(module.asbWriteSubtitleOutput).toBeUndefined();
});

it('skips native allocation and extraction for an empty track selection', () => {
    const module = nativeModule(() => 1);
    module._malloc = () => {
        throw new Error('Unexpected allocation');
    };
    module._asb_extract_subtitles = () => {
        throw new Error('Unexpected extraction');
    };
    expect(
        NativeBridge.create(module).extractSubtitles(
            input,
            [],
            () => {},
            () => {}
        )
    ).toEqual([]);
});

it.each([-1, 1.5, NaN, 0x100000002])('rejects stream index %s before it can narrow to uint32', (index) => {
    const module = nativeModule(() => 1);
    expect(() =>
        NativeBridge.create(module).extractSubtitles(
            input,
            [index],
            () => {},
            () => {}
        )
    ).toThrow('Invalid subtitle track index');
});

it.each(['native error', 'WASM trap', 'input failure', 'output failure'])(
    'releases subtitle argument memory and callbacks after %s',
    (failure) => {
        const module = nativeModule(() => 1);
        const original = new Error(failure);
        const freed: number[] = [];
        module._malloc = () => 8;
        module._free = (pointer) => freed.push(pointer);
        module._asb_extract_subtitles = () => {
            if (failure === 'WASM trap') throw original;
            if (failure === 'input failure') expect(module.asbReadInput!(0, 0, 1)).toBe(-1);
            if (failure === 'output failure') expect(module.asbWriteSubtitleOutput!(2, 0, 1)).toBe(-1);
            return 0;
        };
        const reader = {
            size: 1,
            readAt: () => {
                throw original;
            },
        };
        expect(() =>
            NativeBridge.create(module).extractSubtitles(
                reader,
                [2],
                () => {
                    throw original;
                },
                () => {}
            )
        ).toThrow(failure === 'native error' ? 'Native decoder failed' : original);
        expect(freed).toEqual([8]);
        expect(module.asbReadInput).toBeUndefined();
        expect(module.asbWriteSubtitleOutput).toBeUndefined();
        expect(module.asbDiagnostic).toBeUndefined();
    }
);

it.each(['_asb_extract_subtitles', '_malloc', '_free'] as const)(
    'rejects a runtime missing %s during bridge initialization',
    (name) => {
        const module = nativeModule(() => 1);
        Reflect.deleteProperty(module, name);
        expect(() => NativeBridge.create(module)).toThrow(`Native export ${name} is missing`);
    }
);

it('preserves subtitle results and diagnostics when the sink throws', () => {
    const reports: FfmpegDiagnostics[] = [];
    const module = nativeModule(() => 1);
    module.HEAPU8 = new Uint8Array(64);
    module.UTF8ToString = () => '[]';
    const run = () => {
        module.asbDiagnostic!('ffmpeg', 'warning', 'Subtitle warning');
        return 1;
    };
    module._asb_extract_subtitles = run;
    module._malloc = () => 8;
    module._free = () => {};
    const bridge = NativeBridge.create(module);
    const onDiagnostics = (report: FfmpegDiagnostics) => {
        reports.push(report);
        throw new Error('Logging failed');
    };
    const result = bridge.extractSubtitles(input, [2], () => {}, onDiagnostics);
    expect(result).toEqual([]);
    expect(reports).toEqual([
        {
            messages: [{ source: 'ffmpeg', level: 'warning', message: 'Subtitle warning', occurrences: 1 }],
            omittedMessages: 0,
        },
    ]);
    expect(module.asbDiagnostic).toBeUndefined();
    expect(module.asbReadInput).toBeUndefined();
    expect(module.asbWriteSubtitleOutput).toBeUndefined();
});

it('retains native subtitle failures and their diagnostics when reporting fails', () => {
    const reports: FfmpegDiagnostics[] = [];
    const module = nativeModule(() => 1);
    module._malloc = () => 8;
    module._asb_extract_subtitles = () => {
        module.asbDiagnostic!('ffmpeg', 'error', 'Invalid subtitle container');
        return 0;
    };
    const bridge = NativeBridge.create(module);
    expect(() =>
        bridge.extractSubtitles(
            input,
            [2],
            () => {},
            (report) => {
                reports.push(report);
                throw new Error('Logging failed');
            }
        )
    ).toThrow('Native decoder failed');
    expect(reports[0].messages[0].message).toBe('Invalid subtitle container');
    expect(module.asbDiagnostic).toBeUndefined();
});

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
