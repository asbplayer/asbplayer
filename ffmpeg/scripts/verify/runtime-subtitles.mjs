import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateSubtitleMedia } from './subtitle-test-media.mjs';

const runtimeRoot = resolve(process.argv[2] ?? '/output');
const root = await mkdtemp(resolve(tmpdir(), 'asb-runtime-subtitles-'));
try {
    await generateSubtitleMedia(root);
    const wasmBytes = await readFile(resolve(runtimeRoot, 'ffmpeg-core.wasm'));
    const { default: createRuntime } = await import(pathToFileURL(resolve(runtimeRoot, 'ffmpeg-core.js')).href);
    const module = await createRuntime({
        instantiateWasm(imports, receiveInstance) {
            receiveInstance(new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), imports));
            return {};
        },
    });
    let input;
    let chunksByTrackKey = new Map();
    module.asbReadInput = (offset, pointer, length) => {
        const bytes = input.subarray(offset, offset + length);
        module.HEAPU8.set(bytes, pointer);
        return bytes.length;
    };
    module.asbWriteOutput = (trackKey, pointer, length) => {
        assert.ok(chunksByTrackKey.has(trackKey), 'All chunks must belong to a requested subtitle track key');
        chunksByTrackKey.get(trackKey).push(Buffer.from(module.HEAPU8.subarray(pointer, pointer + length)));
        return length;
    };
    const json = (pointer) => {
        assert.ok(pointer, module.UTF8ToString(module._asb_last_error()));
        return JSON.parse(module.UTF8ToString(pointer));
    };
    const load = async (name) => {
        input = await readFile(resolve(root, name));
    };
    const extract = (trackKeys, extension = 'srt') => {
        chunksByTrackKey = new Map(trackKeys.map((trackKey) => [trackKey, []]));
        const size = trackKeys.length * Uint32Array.BYTES_PER_ELEMENT;
        const pointer = module._malloc(size);
        assert.ok(pointer, 'Could not allocate subtitle track keys');
        try {
            const heap = module.HEAPU8;
            const selected = new DataView(heap.buffer, heap.byteOffset + pointer, size);
            trackKeys.forEach((trackKey, position) => {
                selected.setUint32(position * Uint32Array.BYTES_PER_ELEMENT, trackKey, true);
            });
            const result = json(module._asb_extract_subtitles(input.length, pointer, trackKeys.length));
            assert.deepEqual(
                result.map((track) => track.trackKey),
                trackKeys
            );
            assert.ok(
                result.every(
                    (track) =>
                        track.extension === extension &&
                        track.mimeType === (extension === 'srt' ? 'application/x-subrip' : 'application/x-asbimg')
                )
            );
            return new Map(
                [...chunksByTrackKey].map(([trackKey, chunks]) => [trackKey, Buffer.concat(chunks).toString('utf8')])
            );
        } finally {
            module._free(pointer);
        }
    };
    await load('mixed.mkv');
    const mixed = extract([1, 0]);
    assert.ok(chunksByTrackKey.get(0).length > 1, 'Subtitle cues must be delivered before the entire track is encoded');
    assert.match(chunksByTrackKey.get(0)[0].toString('utf8'), /00:00:09,000 --> 00:00:11,000/);
    assert.doesNotMatch(chunksByTrackKey.get(0)[0].toString('utf8'), /Final cue/);
    assert.match(mixed.get(0), /00:00:09,000 --> 00:00:11,000/);
    assert.match(mixed.get(0), /日本語 &amp; &lt;literal&gt; C:\\new and C:\\Notes\nline two/);
    assert.match(mixed.get(0), /00:00:10,000 --> 00:00:12,000/);
    assert.match(mixed.get(0), /Final cue/);
    assert.match(mixed.get(1), /日本語 text\nline two end \{note \\p1\}/);
    assert.match(mixed.get(1), /Reset text/);
    assert.doesNotMatch(mixed.get(1), /m 0 0|\\h|\\k20|Zero duration cue/);
    assert.match(mixed.get(1), /&lt;b&gt;literal&lt;\/b&gt; &amp;amp;/);
    // Confirmed extraction must finish even with slow, fragmented input reads.
    const readInput = module.asbReadInput;
    const now = performance.now.bind(performance);
    const clockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    let simulatedDelayMs = 0;
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now() + simulatedDelayMs });
    module.asbReadInput = (offset, pointer, length) => {
        const count = readInput(offset, pointer, Math.min(length, 64));
        simulatedDelayMs += 1100;
        return count;
    };
    try {
        assert.deepEqual([...extract([1, 0])], [...mixed]);
        assert.ok(simulatedDelayMs > 5000, 'Extraction must continue through slow input reads');
    } finally {
        module.asbReadInput = readInput;
        if (clockDescriptor) Object.defineProperty(performance, 'now', clockDescriptor);
        else delete performance.now;
    }
    await load('zlib.mkv');
    assert.match(extract([0]).get(0), /00:00:02,000 --> 00:00:04,000\n日本語 compressed text/);
    await load('timed-text.mp4');
    const mp4 = extract([2]).get(2);
    // mov_text samples cannot overlap: the first sample ends at the next sample.
    assert.match(mp4, /00:00:02,000 --> 00:00:03,000/);
    assert.match(mp4, /Final cue/);
    await load('movtext-literal.mp4');
    assert.match(
        extract([2]).get(2),
        /00:00:02,000 --> 00:00:04,000\nC:\\new and C:\\Notes \{\\b1\}tag\{\\b0\} Before \{\\unclosed after/
    );
    await load('movtext-utf16.mp4');
    const utf16Srt = extract([2]).get(2);
    assert.match(utf16Srt, /00:00:02,000 --> 00:00:03,000\n日本語𠀋/);
    assert.match(utf16Srt, /00:00:04,000 --> 00:00:05,000\nHello\n\n/);
    assert.match(utf16Srt, /00:00:06,000 --> 00:00:07,000\nTop\nLine\n\n/);
    assert.ok(!utf16Srt.includes('\0'), 'Extracted SRT must not contain raw NUL bytes');
    assert.doesNotMatch(utf16Srt, /ignored/);
    await load('movtext-unreadable.mp4');
    assert.throws(() => extract([2]), /Could not finish subtitle output/);
    await load('delayed.mp4');
    assert.match(extract([2]).get(2), /00:00:12,000 --> 00:00:13,000/);
    // Guard against unbounded WASM heap growth across repeated extractions.
    const initialMemory = module.HEAPU8.buffer.byteLength;
    for (let repeat = 0; repeat < 10; ++repeat) extract([2]);
    assert.equal(module.HEAPU8.buffer.byteLength, initialMemory);
    assert.throws(() => extract([1]), /Invalid subtitle track key/);
    await load('unsupported-first.mp4');
    assert.throws(() => extract([2]), /Unsupported subtitle track/);
    assert.match(extract([3]).get(3), /Final cue/);
    await load('webvtt-first.mp4');
    assert.match(extract([3]).get(3), /Final cue/);
    await load('empty-audio.mkv');
    assert.match(extract([0]).get(0), /Final cue/);
    await load('reordered.mkv');
    assert.match(extract([0]).get(0), /Earlier cue[\s\S]+Later cue/);
    await load('dense.mkv');
    const dense = extract([0]).get(0);
    assert.equal([...dense.matchAll(/^Dense cue \d+$/gm)].length, 300);
    assert.match(dense, /Dense cue 0[\s\S]+Dense cue 299/);
    await load('empty-ass-header.mkv');
    assert.match(extract([0]).get(0), /00:00:02,000 --> 00:00:03,000\nHeaderless ASS cue/);
    await load('webvtt-nbsp.mkv');
    assert.match(
        extract([0]).get(0),
        /00:00:02,000 --> 00:00:03,000\nfirst second \{music\} C:\\path \\h &lt;tag&gt; &amp;/
    );
    await load('raw-text.mkv');
    assert.match(extract([0]).get(0), /00:00:02,000 --> 00:00:03,000\n\{music\} C:\\path\nsecond line/);
    await load('non-utf8.mkv');
    assert.match(
        extract([0]).get(0),
        /00:00:02,000 --> 00:00:03,000\ncaf\ufffd[\s\S]+00:00:04,000 --> 00:00:05,000\nAfter Latin-1/
    );
    const warnings = [];
    module.asbDiagnostic = (_source, level, message) => {
        if (level === 'warning') warnings.push(message);
    };
    await load('outside-reorder-window.mkv');
    assert.throws(() => extract([0]), /Could not extract subtitle packets/);
    assert.deepEqual(warnings, ['Subtitle cue exceeds the reorder window']);
    assert.match(Buffer.concat(chunksByTrackKey.get(0)).toString('utf8'), /Published cue/);
    assert.doesNotMatch(Buffer.concat(chunksByTrackKey.get(0)).toString('utf8'), /Too late|Buffered cue/);
    const imageRecords = (trackKey) =>
        extract([trackKey], 'asbimg')
            .get(trackKey)
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
    for (const name of ['pgs.mkv', 'dvd.mkv', 'dvb.mkv', 'dvd.mp4']) {
        const codec = name.split('.')[0];
        await load(name);
        const trackKey = name.endsWith('.mp4') ? 2 : 0;
        const records = imageRecords(trackKey);
        assert.equal(records.length, 2, `${codec}: clears must close images without becoming cues`);
        assert.equal(records[0].start, 2000);
        assert.ok(records[0].end >= 3900 && records[0].end <= 4000);
        assert.equal(records[1].start, 6000);
        assert.ok(chunksByTrackKey.get(trackKey).length >= 2, 'Images must be delivered progressively');
        for (const { textImage: image } of records) {
            assert.equal(image.position, undefined);
            assert.deepEqual(image.screen, { width: 320, height: 240 });
            assert.match(image.dataUrl, /^data:image\/png;base64,/);
        }
        if (codec === 'pgs') {
            const image = records[0].textImage;
            assert.deepEqual(image.image, { width: 14, height: 4 });
            const png = Buffer.from(image.dataUrl.split(',')[1], 'base64');
            const pixels = execFileSync(
                'ffmpeg',
                ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'],
                { input: png }
            );
            assert.deepEqual([...pixels.subarray(0, 4)], [255, 255, 255, 255]);
            assert.equal(pixels[7], 128, 'Palette alpha must survive PNG encoding');
            assert.equal(pixels[11], 0, 'Transparent pixels must stay transparent');
            const secondRectangle = (2 * 14 + 10) * 4;
            assert.equal(pixels[secondRectangle + 3], 255, 'All rectangles must retain their relative positions');
        }
        const imageMemory = module.HEAPU8.buffer.byteLength;
        for (let repeat = 0; repeat < 5; ++repeat) extract([trackKey], 'asbimg');
        assert.equal(
            module.HEAPU8.buffer.byteLength,
            imageMemory,
            `${codec}: repeated extraction must release native resources`
        );
    }
    await load('dvd-cover.mkv');
    assert.equal(imageRecords(0).length, 2, 'Attached cover art must not delay the subtitle timeline');
    await load('uncleared.mkv');
    const uncleared = imageRecords(0);
    assert.equal(uncleared.length, 2);
    assert.equal(uncleared[1].start, 6000);
    assert.equal(uncleared[1].end, 10000, 'Container duration must bound the last display when its clear is absent');
    process.stdout.write(
        'WASM subtitle regressions passed: track identity, presentation timing, reordered cues, text normalization, slow reads, zlib, PGS/DVD/DVB bitmaps\n'
    );
} finally {
    await rm(root, { recursive: true, force: true });
}
