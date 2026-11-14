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

const checkTone = (audio, start, end, label, expectedFrequency = toneHz) => {
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
    assert.ok(
        Math.abs(frequency - expectedFrequency) < 5,
        `${label}: expected ${expectedFrequency} Hz, got ${frequency} Hz`
    );
};

const maximumSampleStep = (audio, start, end) => {
    let maximum = 0;
    for (let index = Math.round(start * sampleRate) + 1; index < Math.round(end * sampleRate); ++index) {
        maximum = Math.max(maximum, Math.abs(audio[index * channels] - audio[(index - 1) * channels]));
    }
    return maximum;
};

// Older system FFmpeg versions cannot mux ISO floating-point PCM into MP4.
// Author a single-chunk fpcm track with its pcmC format/endian declaration.
const pcmMp4 = (bits) => {
    const integers = (...values) => {
        const bytes = Buffer.alloc(values.length * 4);
        values.forEach((value, index) => bytes.writeUInt32BE(value, index * 4));
        return bytes;
    };
    const box = (name, ...parts) => {
        const data = Buffer.concat(parts);
        return Buffer.concat([integers(data.length + 8), Buffer.from(name), data]);
    };
    const samples = sampleRate;
    const bytesPerSample = bits / 8;
    const data = Buffer.alloc(samples * channels * bytesPerSample);
    for (let sample = 0; sample < samples; sample++) {
        const value = 0.1 * Math.sin((2 * Math.PI * toneHz * sample) / sampleRate);
        for (let channel = 0; channel < channels; channel++) {
            const offset = (sample * channels + channel) * bytesPerSample;
            if (bits === 32) data.writeFloatBE(value, offset);
            else data.writeDoubleBE(value, offset);
        }
    }
    const ftyp = box('ftyp', Buffer.from('isom'), integers(512), Buffer.from('isomiso6mp41'));
    const tkhd = Buffer.alloc(84);
    tkhd[3] = 3;
    tkhd.writeUInt32BE(1, 12);
    tkhd.writeUInt32BE(samples, 20);
    const mdhd = box('mdhd', integers(0, 0, 0, sampleRate, samples), Buffer.from([0x55, 0xc4, 0, 0]));
    const hdlr = box('hdlr', integers(0, 0), Buffer.from('soun'), Buffer.alloc(12));
    const entry = Buffer.alloc(28);
    entry.writeUInt16BE(1, 6); // data_reference_index
    entry.writeUInt16BE(channels, 16);
    entry.writeUInt16BE(bits, 18);
    entry.writeUInt32BE(sampleRate * 65536, 24);
    const stsd = box('stsd', integers(0, 1), box('fpcm', entry, box('pcmC', integers(0), Buffer.from([0, bits]))));
    const stbl = box(
        'stbl',
        stsd,
        box('stts', integers(0, 1, samples, 1)),
        box('stsc', integers(0, 1, 1, samples, 1)),
        box('stsz', integers(0, bytesPerSample * channels, samples)),
        box('stco', integers(0, 1, ftyp.length + 8))
    );
    const minf = box(
        'minf',
        box('smhd', Buffer.alloc(8)),
        box('dinf', box('dref', integers(0, 1), box('url ', integers(1)))),
        stbl
    );
    return Buffer.concat([
        ftyp,
        box('mdat', data),
        box('moov', box('trak', box('tkhd', tkhd), box('mdia', mdhd, hdlr, minf))),
    ]);
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
    const transcode = async (file, { trackIndex = 0, onDiagnostic } = {}) => {
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
        const duration = module._asb_transcode_audio(input.length, trackIndex);
        assert.ok(duration > 0, module.UTF8ToString(module._asb_last_error()));
        const output = `${file}.webm`;
        await writeFile(output, Buffer.concat(chunks));
        const audio = decode(output);
        assert.ok(Math.abs(duration - audio.length / channels / sampleRate) < 0.001, 'reported sample duration');
        return { audio, duration, diagnostics };
    };

    // Explicit selection must decode browser-playable formats too, not just Dolby/DTS.
    const audioFormats = [
        ['aac', 'mp4'],
        ['libopus', 'mkv'],
        ['libmp3lame', 'mkv'],
        ['flac', 'mkv'],
        ['libvorbis', 'mkv'],
        ['mp2', 'mkv'],
        ['alac', 'mp4'],
        ['wavpack', 'mkv'],
        ['tta', 'mkv'],
        ['pcm_s16le', 'mkv'],
        ['pcm_s16be', 'mkv'],
        ['pcm_s24le', 'mkv'],
        ['pcm_s24be', 'mkv'],
        ['pcm_s32le', 'mkv'],
        ['pcm_s32be', 'mkv'],
        ['pcm_f32le', 'mkv'],
        ['pcm_f64le', 'mkv'],
        ['pcm_u8', 'mkv'],
        ['pcm_alaw', 'mkv'],
        ['pcm_mulaw', 'mkv'],
        ['adpcm_ms', 'mkv'],
        ['adpcm_ima_wav', 'mkv'],
    ];
    for (const [codec, extension] of audioFormats) {
        const input = join(root, `${codec}.${extension}`);
        ffmpeg(
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${toneHz}:sample_rate=${sampleRate}:duration=1.1`,
            '-ac',
            `${channels}`,
            '-c:a',
            codec,
            input
        );
        const converted = await transcode(input);
        checkTone(converted.audio, 0.2, 0.9, codec);
    }
    for (const bits of [32, 64]) {
        const input = join(root, `pcm_f${bits}be.mp4`);
        await writeFile(input, pcmMp4(bits));
        const converted = await transcode(input);
        checkTone(converted.audio, 0.2, 0.9, `MP4 float${bits} big-endian PCM`);
    }

    // System FFmpeg has no MP1 encoder. Zero bit allocations author silent
    // MPEG-1 Layer I frames: 128 kbit/s, 48 kHz, stereo, 384 samples each.
    const mp1Frame = Buffer.alloc(128);
    mp1Frame.writeUInt32BE(0xffff4400);
    const mp1Raw = join(root, 'silence.mp1');
    const mp1 = join(root, 'mp1.mkv');
    await writeFile(mp1Raw, Buffer.concat(Array(126).fill(mp1Frame)));
    ffmpeg('-i', mp1Raw, '-c:a', 'copy', mp1);
    const mp1Audio = await transcode(mp1);
    checkSampleCount(mp1Audio, 126 * 384, 'MPEG-1 Layer I');
    assert.ok(
        mp1Audio.audio.every((sample) => Math.abs(sample) < 0.001),
        'MP1 silent frames stay silent'
    );

    // Distinct tones prove that the audio-relative selection picks the requested stream.
    const secondToneHz = 1703;
    for (const extension of ['mp4', 'mkv']) {
        const input = join(root, `multi-aac.${extension}`);
        ffmpeg(
            '-f',
            'lavfi',
            '-i',
            'color=c=black:s=32x32:r=25:d=1.1',
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${toneHz}:sample_rate=${sampleRate}:duration=1.1`,
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${secondToneHz}:sample_rate=${sampleRate}:duration=1.1`,
            '-map',
            '0:v',
            '-map',
            '1:a',
            '-map',
            '2:a',
            '-c:v',
            'mpeg4',
            '-c:a',
            'aac',
            input
        );
        for (const trackIndex of [0, 1]) {
            const converted = await transcode(input, { trackIndex });
            checkTone(
                converted.audio,
                0.2,
                0.9,
                `${extension} AAC track ${trackIndex}`,
                trackIndex === 0 ? toneHz : secondToneHz
            );
        }
    }

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

    // H.264 probing can infer a negative video start from audio. Neither that nor
    // actual negative video preroll may rebase the browser's clock: the beep is at 0.5 s.
    for (const [name, videoFilter] of [
        ['negative-audio', 'null'],
        ['negative-audio-and-video', 'setpts=PTS-0.5/TB'],
    ]) {
        const negativeAudio = join(root, `${name}.mkv`);
        ffmpeg(
            '-f',
            'lavfi',
            '-i',
            'color=c=black:s=32x32:r=25:d=4',
            '-f',
            'lavfi',
            '-i',
            `aevalsrc='if(between(t,1,1.5),0.1*sin(2*PI*${toneHz}*t),0)':s=${sampleRate}:d=4`,
            '-af',
            'asetpts=PTS-0.5/TB',
            '-vf',
            videoFilter,
            '-c:v',
            'libx264',
            '-c:a',
            'ac3',
            '-avoid_negative_ts',
            'disabled',
            negativeAudio
        );
        const negativeResult = await transcode(negativeAudio);
        assert.ok(
            negativeResult.audio.subarray(0, 0.4 * sampleRate * channels).every((sample) => Math.abs(sample) < 0.001)
        );
        checkTone(negativeResult.audio, 0.6, 0.85, `${name}: beep on video clock`);
        const negativeReference = ffmpeg(
            '-copyts',
            '-i',
            negativeAudio,
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
        const negativeDuration = negativeReference.length / Float32Array.BYTES_PER_ELEMENT / channels / sampleRate;
        assert.ok(
            Math.abs(negativeResult.duration - negativeDuration) < 0.001,
            `${name}: trimmed duration within the millisecond timestamp precision`
        );
    }

    // A lossless remux preserves Matroska's rounded timestamps even when MP4 uses
    // a finer time base. A steady tone must not acquire repeated silence/trim splices.
    const rounded = join(root, 'rounded-eac3.mkv');
    ffmpeg(
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=32x32:r=25:d=6',
        '-itsoffset',
        '0.7',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneHz}:sample_rate=44100:duration=6`,
        '-c:v',
        'mpeg4',
        '-c:a',
        'eac3',
        rounded
    );
    const remuxed = join(root, 'rounded-eac3.mp4');
    ffmpeg('-i', rounded, '-c', 'copy', remuxed);
    assert.deepEqual(
        ffmpeg('-i', rounded, '-map', '0:a:0', '-c:a', 'copy', '-f', 'eac3', '-'),
        ffmpeg('-i', remuxed, '-map', '0:a:0', '-c:a', 'copy', '-f', 'eac3', '-'),
        'remux fixture preserves encoded audio packets'
    );
    const roundedResult = await transcode(rounded);
    const remuxedResult = await transcode(remuxed);
    checkTone(remuxedResult.audio, 1, 5, 'remuxed timestamp rounding');
    assert.ok(
        maximumSampleStep(remuxedResult.audio, 1, 5) < 2 * maximumSampleStep(roundedResult.audio, 1, 5),
        'remuxed timestamps must not introduce discontinuities into a steady tone'
    );
    assert.ok(
        remuxedResult.audio.subarray(0, 0.6 * sampleRate * channels).every((sample) => Math.abs(sample) < 0.001),
        'remuxed timestamp rounding retains the real leading offset'
    );

    // Delayed Matroska audio still needs its leading silence on the video clock.
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

    // A corrupt cluster clock used to overflow the sample timestamp and loop
    // inserting silence. Keep the EBML sizes unchanged so demuxing reaches it.
    const invalidClock = await readFile(intact);
    const scale = invalidClock.indexOf(Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]));
    assert.ok(scale >= 0, 'fixture has the default millisecond TimestampScale');
    invalidClock.set([0x3d, 0x09, 0x00], scale + 4); // Four milliseconds per tick.
    const cluster = invalidClock.indexOf(Buffer.from([0x1f, 0x43, 0xb6, 0x75]));
    assert.ok(cluster >= 0, 'fixture has a Cluster');
    let sizeBytes = 1;
    while (sizeBytes <= 8 && !(invalidClock[cluster + 4] & (0x80 >> (sizeBytes - 1)))) ++sizeBytes;
    assert.ok(sizeBytes <= 8, 'fixture has a valid Cluster size');
    const clock = cluster + 4 + sizeBytes;
    assert.deepEqual([...invalidClock.subarray(clock, clock + 2)], [0xbf, 0x84], 'fixture Cluster starts with CRC-32');
    assert.deepEqual([...invalidClock.subarray(clock + 6, clock + 9)], [0xe7, 0x81, 0], 'fixture starts at zero');
    invalidClock.set([0xe7, 0x87, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], clock);
    module.asbReadInput = (offset, pointer, length) => {
        const bytes = invalidClock.subarray(offset, offset + length);
        module.HEAPU8.set(bytes, pointer);
        return bytes.length;
    };
    module.asbWriteOutput = (_pointer, length) => length;
    assert.equal(module._asb_transcode_audio(invalidClock.length, 0), -1, 'unrepresentable sample clock is rejected');
    assert.match(module.UTF8ToString(module._asb_last_error()), /Invalid data/, 'invalid clock reports a native error');
    checkSampleCount(await transcode(intact), undamaged.audio.length / channels, 'recovery after invalid timestamps');

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
        await transcode(tail, {
            onDiagnostic: () => {
                throw new Error('Diagnostic sink failed');
            },
        }),
        tailSamples,
        'throwing diagnostic sink preserves native conversion and cleanup'
    );

    process.stdout.write(
        'WASM audio regressions passed: common audio formats, MP4/MKV AAC track selection, MP4 preroll/positive start, negative audio preroll, remuxed timestamp rounding, Matroska offset, AC3 layout/rate changes, DTS/TrueHD timestamp rounding, corrupt frames/timestamps, resampler/Opus finalization\n'
    );
} finally {
    await rm(root, { recursive: true, force: true });
}
