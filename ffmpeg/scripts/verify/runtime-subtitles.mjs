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
    let outputs = new Map();
    module.asbReadInput = (offset, pointer, length) => {
        const bytes = input.subarray(offset, offset + length);
        module.HEAPU8.set(bytes, pointer);
        return bytes.length;
    };
    module.asbWriteSubtitleOutput = (index, pointer, length) => {
        assert.ok(outputs.has(index), 'All chunks must belong to a requested subtitle track index');
        outputs.get(index).push(Buffer.from(module.HEAPU8.subarray(pointer, pointer + length)));
        return length;
    };
    const json = (pointer) => {
        assert.ok(pointer, module.UTF8ToString(module._asb_last_error()));
        return JSON.parse(module.UTF8ToString(pointer));
    };
    const load = async (name) => {
        input = await readFile(resolve(root, name));
    };
    const extract = (indexes, extension = 'srt') => {
        outputs = new Map(indexes.map((index) => [index, []]));
        const size = indexes.length * Uint32Array.BYTES_PER_ELEMENT;
        const pointer = module._malloc(size);
        assert.ok(pointer, 'Could not allocate subtitle track indexes');
        try {
            const heap = module.HEAPU8;
            const selected = new DataView(heap.buffer, heap.byteOffset + pointer, size);
            indexes.forEach((index, position) => {
                selected.setUint32(position * Uint32Array.BYTES_PER_ELEMENT, index, true);
            });
            const result = json(module._asb_extract_subtitles(input.length, pointer, indexes.length));
            assert.deepEqual(
                result.map((track) => track.trackIndex),
                indexes
            );
            assert.ok(
                result.every(
                    (track) =>
                        track.extension === extension &&
                        track.mimeType === (extension === 'srt' ? 'application/x-subrip' : 'application/x-asbimg')
                )
            );
            return new Map([...outputs].map(([index, chunks]) => [index, Buffer.concat(chunks).toString('utf8')]));
        } finally {
            module._free(pointer);
        }
    };
    await load('mixed.mkv');
    const mixed = extract([1, 0]);
    assert.ok(outputs.get(0).length > 1, 'Subtitle cues must be delivered before the entire track is encoded');
    assert.match(outputs.get(0)[0].toString('utf8'), /00:00:02,000 --> 00:00:04,000/);
    assert.doesNotMatch(outputs.get(0)[0].toString('utf8'), /Final cue/);
    assert.match(mixed.get(0), /00:00:02,000 --> 00:00:04,000/);
    assert.match(mixed.get(0), /00:00:03,000 --> 00:00:05,000/);
    assert.match(mixed.get(0), /Final cue/);
    assert.match(mixed.get(1), /日本語 text\nline two end/);
    assert.doesNotMatch(mixed.get(1), /m 0 0|\\h|\\k20/);
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
    const mp4 = extract([0]).get(0);
    // mov_text samples cannot overlap: the first sample ends at the next sample.
    assert.match(mp4, /00:00:02,000 --> 00:00:03,000/);
    assert.match(mp4, /Final cue/);
    // Guard against unbounded WASM heap growth across repeated extractions.
    const initialMemory = module.HEAPU8.buffer.byteLength;
    for (let repeat = 0; repeat < 10; ++repeat) extract([0]);
    assert.equal(module.HEAPU8.buffer.byteLength, initialMemory);
    assert.throws(() => extract([1]), /Invalid subtitle track index/);
    await load('unsupported-first.mp4');
    assert.throws(() => extract([0]), /Unsupported subtitle track/);
    assert.match(extract([1]).get(1), /Final cue/);
    for (const name of ['pgs.mkv', 'dvd.mkv', 'dvb.mkv', 'dvd.mp4']) {
        const codec = name.split('.')[0];
        await load(name);
        const records = extract([0], 'asbimg')
            .get(0)
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        assert.equal(records.length, 2, `${codec}: clears must close images without becoming cues`);
        assert.equal(records[0].start, 2000);
        assert.ok(records[0].end >= 3900 && records[0].end <= 4000);
        assert.equal(records[1].start, 6000);
        assert.ok(outputs.get(0).length >= 2, 'Images must be delivered progressively');
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
        for (let repeat = 0; repeat < 5; ++repeat) extract([0], 'asbimg');
        assert.equal(
            module.HEAPU8.buffer.byteLength,
            imageMemory,
            `${codec}: repeated extraction must release native resources`
        );
    }
    await load('dvd-cover.mkv');
    assert.equal(
        extract([0], 'asbimg').get(0).trim().split('\n').length,
        2,
        'Attached cover art must not delay the subtitle timeline'
    );
    await load('uncleared.mkv');
    const uncleared = extract([0], 'asbimg')
        .get(0)
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
    assert.equal(uncleared.length, 2);
    assert.equal(uncleared[1].start, 6000);
    assert.equal(uncleared[1].end, 10000, 'Container duration must bound the last display when its clear is absent');
    process.stdout.write(
        'WASM subtitle regressions passed: mixed streams/nonzero origin, text normalization, slow input reads, zlib, PGS/DVD/DVB bitmaps\n'
    );
} finally {
    await rm(root, { recursive: true, force: true });
}
