import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const runtimeRoot = resolve(process.argv[2] ?? '/output');
const root = await mkdtemp(join(tmpdir(), 'asb-runtime-audio-'));
const sampleRate = 48_000;
const channels = 2;
const toneHz = 997;

const ffmpeg = (...args) => {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr.toString());
    return result.stdout;
};

const decode = (file) => {
    const bytes = ffmpeg('-i', file, '-map', '0:a:0', '-ac', `${channels}`, '-ar', `${sampleRate}`, '-f', 'f32le', '-');
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
};

const checkSampleCount = ({ audio, duration }, expectedSamples, label) => {
    assert.equal(audio.length / channels, expectedSamples, `${label}: decoded sample count`);
    assert.equal(Math.round(duration * sampleRate), expectedSamples, `${label}: reported sample count`);
};

const checkTone = (audio, start, end, label) => {
    let power = 0;
    let crossings = 0;
    const first = Math.round(start * sampleRate);
    const last = Math.round(end * sampleRate);
    assert.ok(audio.length >= last * channels, `${label}: audio ended early`);
    for (let index = first; index < last; ++index) {
        const value = audio[index * channels];
        power += value * value;
        if (index > first && audio[(index - 1) * channels] < 0 && value >= 0) ++crossings;
    }
    assert.ok(Math.sqrt(power / (last - first)) > 0.03, `${label}: expected audible audio`);
    const frequency = (crossings * sampleRate) / (last - first);
    assert.ok(Math.abs(frequency - toneHz) < 5, `${label}: expected ${toneHz} Hz, got ${frequency} Hz`);
};

try {
    const wasmBytes = await readFile(join(runtimeRoot, 'ffmpeg-core.wasm'));
    const { default: createRuntime } = await import(pathToFileURL(join(runtimeRoot, 'ffmpeg-core.js')).href);
    const module = await createRuntime({
        instantiateWasm(imports, receiveInstance) {
            receiveInstance(new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), imports));
            return {};
        },
    });
    const transcode = async (file, onDiagnostic) => {
        const input = await readFile(file);
        const chunks = [];
        const diagnostics = [];
        module.asbDiagnostic = (source, level, message) => {
            diagnostics.push({ source, level, message });
            onDiagnostic?.(source, level, message);
        };
        module.asbReadInput = (offset, pointer, length) => {
            const bytes = input.subarray(offset, offset + length);
            module.HEAPU8.set(bytes, pointer);
            return bytes.length;
        };
        module.asbWriteOutput = (pointer, length) => {
            chunks.push(Buffer.from(module.HEAPU8.slice(pointer, pointer + length)));
            return length;
        };
        const duration = module._asb_transcode_audio(input.length, 0);
        assert.ok(duration > 0, module.UTF8ToString(module._asb_last_error()));
        const output = `${file}.webm`;
        await writeFile(output, Buffer.concat(chunks));
        const audio = decode(output);
        assert.ok(Math.abs(duration - audio.length / channels / sampleRate) < 0.001, 'reported sample duration');
        return { audio, duration, diagnostics };
    };

    const source = join(root, 'source.mp4');
    ffmpeg(
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=32x32:r=25:d=8',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneHz}:sample_rate=${sampleRate}:duration=8`,
        '-c:v',
        'mpeg4',
        '-g',
        '100',
        '-c:a',
        'ac3',
        source
    );
    const cut = join(root, 'cut.mp4');
    ffmpeg('-ss', '1', '-i', source, '-c', 'copy', cut);
    const trimmed = await transcode(cut);
    checkTone(trimmed.audio, 0.1, 0.6, 'MP4 edit-list preroll');
    const expectedDuration = decode(cut).length / channels / sampleRate;
    assert.ok(Math.abs(trimmed.duration - expectedDuration) < 0.001, 'MP4 edit-list duration');

    // Browsers retain a positive presentation start. Keep the audio on that same timeline.
    const offset = join(root, 'offset.mp4');
    ffmpeg('-i', source, '-c', 'copy', '-output_ts_offset', '10', offset);
    const offsetAudio = await transcode(offset);
    assert.ok(
        offsetAudio.audio.subarray(0, 9.9 * sampleRate * channels).every((sample) => Math.abs(sample) < 0.001),
        'positive MP4 start: leading silence'
    );
    checkTone(offsetAudio.audio, 10.2, 10.7, 'positive MP4 start');
    assert.ok(
        offsetAudio.diagnostics.some(
            ({ source, level, message }) =>
                source === 'runtime' && level === 'trace' && /inserted [1-9]\d* silence samples/.test(message)
        ),
        'expected leading silence is recorded as diagnostic context'
    );
    const offsetReference = ffmpeg(
        '-copyts',
        '-i',
        offset,
        '-map',
        '0:a:0',
        '-af',
        'aresample=async=1:first_pts=0',
        '-ac',
        `${channels}`,
        '-ar',
        `${sampleRate}`,
        '-f',
        'f32le',
        '-'
    );
    const offsetDuration = offsetReference.length / Float32Array.BYTES_PER_ELEMENT / channels / sampleRate;
    assert.ok(Math.abs(offsetAudio.duration - offsetDuration) < 0.001, 'positive MP4 start: timeline duration');

    // The packet-origin fallback is still needed for delayed Matroska audio.
    const delayed = join(root, 'delayed.mkv');
    ffmpeg(
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=32x32:r=25:d=5',
        '-itsoffset',
        '1',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneHz}:sample_rate=44100:duration=3`,
        '-c:v',
        'mpeg4',
        '-c:a',
        'ac3',
        delayed
    );
    const delayedAudio = (await transcode(delayed)).audio;
    assert.ok(delayedAudio.subarray(0, 0.9 * sampleRate * channels).every((sample) => Math.abs(sample) < 0.001));
    checkTone(delayedAudio, 1.2, 1.7, 'delayed Matroska audio');

    const formats = { stereo: [2, 48000], mono: [1, 48000], surround: [6, 48000], resampled: [2, 44100] };
    for (const [name, [count, rate]] of Object.entries(formats)) {
        ffmpeg(
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${toneHz}:sample_rate=${rate}:duration=6`,
            '-ac',
            `${count}`,
            '-c:a',
            'ac3',
            '-f',
            'ac3',
            join(root, `${name}.ac3`)
        );
    }
    for (const [first, second] of [
        ['stereo', 'stereo'],
        ['resampled', 'resampled'],
        ['stereo', 'mono'],
        ['surround', 'stereo'],
        ['stereo', 'surround'],
        ['stereo', 'resampled'],
        ['resampled', 'stereo'],
    ]) {
        const name = `${first}-${second}`;
        const raw = join(root, `${name}.ac3`);
        await writeFile(
            raw,
            Buffer.concat(await Promise.all([first, second].map((part) => readFile(join(root, `${part}.ac3`)))))
        );
        const input = join(root, `${name}.mkv`);
        ffmpeg('-i', raw, '-c:a', 'copy', input);
        const { audio, duration, diagnostics } = await transcode(input);
        checkTone(audio, 1, 2, `${name} before transition`);
        checkTone(audio, 8, 9, `${name} after transition`);
        assert.ok(Math.abs(duration - decode(input).length / channels / sampleRate) < 0.01, `${name}: duration`);
        if (first === 'stereo' && second === 'resampled') {
            const rates = diagnostics
                .filter(({ source, message }) => source === 'runtime' && message.startsWith('Decoded audio format:'))
                .map(({ message }) => Number(message.match(/sample_rate=(\d+)/)[1]));
            assert.deepEqual(rates, [48000, 44100], 'diagnostics describe actual decoded format transitions');
        }
    }

    // Matroska rounds timestamps to milliseconds: neither DTS's 512-sample frames
    // nor TrueHD's 40-sample frames at 48 kHz fit that clock. Preserve every sample.
    for (const [codec, format] of [
        ['dca', 'dts'],
        ['truehd', 'truehd'],
    ]) {
        const raw = join(root, `timestamp-rounding.${format}`);
        ffmpeg(
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${toneHz}:sample_rate=${sampleRate}:duration=6`,
            '-ac',
            `${channels}`,
            '-c:a',
            codec,
            '-strict',
            'experimental',
            '-f',
            format,
            raw
        );
        const input = join(root, `timestamp-rounding-${format}.mkv`);
        // Remux elementary audio so encoder priming does not introduce a start offset.
        ffmpeg('-i', raw, '-c:a', 'copy', input);
        const result = await transcode(input);
        checkSampleCount(result, decode(input).length / channels, `${format} timestamp rounding`);
        checkTone(result.audio, 4, 5, `${format} after repeated timestamp rounding`);
    }

    // Like the ffmpeg CLI, damaged frames must not discard the track. Their timestamp gap keeps sync.
    const intact = join(root, 'intact.mkv');
    ffmpeg(
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneHz}:sample_rate=${sampleRate}:duration=6`,
        '-ac',
        `${channels}`,
        '-c:a',
        'eac3',
        intact
    );
    const corruptBytes = await readFile(intact);
    // Alternate missing sync words (rejected without a native log) with invalid
    // bitstream IDs (logged by the decoder). Both recovery paths need diagnostics.
    let damagedFrames = 0;
    for (let index = Math.floor(corruptBytes.length * 0.45); index < corruptBytes.length * 0.55; ++index) {
        if (corruptBytes[index] === 0x0b && corruptBytes[index + 1] === 0x77) {
            if (damagedFrames++ % 2 === 0) corruptBytes[index] = 0;
            else corruptBytes[index + 5] |= 0xf8;
        }
    }
    const corrupt = join(root, 'corrupt.mkv');
    await writeFile(corrupt, corruptBytes);
    const damaged = await transcode(corrupt);
    assert.equal(
        damaged.diagnostics.filter(
            ({ source, level, message }) =>
                source === 'runtime' && level === 'warning' && /Tolerated [1-9]\d* audio decoder errors/.test(message)
        ).length,
        1,
        'corrupt frames produce one recovery summary'
    );
    assert.ok(
        damaged.diagnostics.some(({ source, level }) => source === 'ffmpeg' && level === 'error'),
        'native decoder diagnostics reach the host'
    );
    const undamaged = await transcode(intact);
    assert.ok(Math.abs(damaged.duration - undamaged.duration) < 0.01, 'corrupt frames: duration');
    assert.ok(
        !undamaged.diagnostics.some(({ source, level }) => source === 'runtime' && level === 'warning'),
        'recovery counts do not leak into the next conversion'
    );
    checkTone(damaged.audio, 0.5, 2, 'before corrupt frames');
    checkTone(damaged.audio, 4.5, 5.5, 'after corrupt frames');

    // This short 44.1 kHz stream requires both resampler draining and a partial
    // final Opus frame. Millisecond tolerances would hide the lost resampler tail.
    const tailRaw = join(root, 'resampler-tail.ac3');
    ffmpeg(
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneHz}:sample_rate=44100:duration=0.137`,
        '-ac',
        `${channels}`,
        '-c:a',
        'ac3',
        '-f',
        'ac3',
        tailRaw
    );
    const tail = join(root, 'resampler-tail.mkv');
    ffmpeg('-i', tailRaw, '-c:a', 'copy', tail);
    const tailSamples = decode(tail).length / channels;
    assert.notEqual(tailSamples % 960, 0, 'fixture must end in a partial 20 ms Opus frame');
    checkSampleCount(await transcode(tail), tailSamples, 'resampler tail and partial final Opus frame');
    checkSampleCount(
        await transcode(tail, () => {
            throw new Error('Diagnostic sink failed');
        }),
        tailSamples,
        'throwing diagnostic sink preserves native conversion and cleanup'
    );

    process.stdout.write(
        'WASM audio regressions passed: MP4 preroll/positive start, Matroska offset, AC3 layout/rate changes, DTS/TrueHD timestamp rounding, corrupt frames, resampler/Opus finalization\n'
    );
} finally {
    await rm(root, { recursive: true, force: true });
}
