// Pure-JS animated WebP muxer: extracts the VP8/VP8L bitstream from each browser-produced static
// WebP and re-muxes them into one animated WebP container (VP8X + ANIM + one ANMF per frame).
// Container reference: https://developers.google.com/speed/webp/docs/riff_container

export interface AnimatedWebpFrame {
    // A complete static WebP file (RIFF/WEBP container), e.g. the bytes behind a
    // `canvas.toDataURL('image/webp')` data URL.
    readonly data: Uint8Array;
    // How long this frame should be shown, in milliseconds.
    readonly durationMs: number;
}

interface RiffChunk {
    readonly fourCC: string;
    // Offset of the chunk's 4-byte FourCC within the source buffer.
    readonly start: number;
    // Offset just past the chunk, including the trailing pad byte when the payload size is odd.
    readonly end: number;
    // The chunk payload (excludes the 8-byte header and any pad byte).
    readonly payload: Uint8Array;
}

const fourCCBytes = (s: string) =>
    Uint8Array.from([s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]);

const readFourCC = (data: Uint8Array, offset: number) =>
    String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);

const readUint24LE = (data: Uint8Array, offset: number) =>
    data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);

const readUint32LE = (data: Uint8Array, offset: number) =>
    (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;

const writeUint24LE = (data: Uint8Array, offset: number, value: number) => {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
    data[offset + 2] = (value >>> 16) & 0xff;
};

const writeUint32LE = (data: Uint8Array, offset: number, value: number) => {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
    data[offset + 2] = (value >>> 16) & 0xff;
    data[offset + 3] = (value >>> 24) & 0xff;
};

// Parse the top-level chunks of a RIFF/WEBP container (the chunks after the `WEBP` FourCC).
const parseRiffChunks = (data: Uint8Array): RiffChunk[] => {
    if (data.length < 12 || readFourCC(data, 0) !== 'RIFF' || readFourCC(data, 8) !== 'WEBP') {
        throw new Error('Not a RIFF/WEBP container');
    }

    const chunks: RiffChunk[] = [];
    let offset = 12;

    while (offset + 8 <= data.length) {
        const fourCC = readFourCC(data, offset);
        const size = readUint32LE(data, offset + 4);
        const payloadStart = offset + 8;
        const payloadEnd = payloadStart + size;

        if (payloadEnd > data.length) {
            break;
        }

        // Chunks are padded to an even number of bytes.
        const end = payloadEnd + (size & 1);
        chunks.push({ fourCC, start: offset, end, payload: data.subarray(payloadStart, payloadEnd) });
        offset = end;
    }

    return chunks;
};

// Read the pixel dimensions of a static WebP from its image chunk header (VP8X canvas size, the
// VP8L 14-bit fields, or the VP8 key-frame dimensions).
const readWebpDimensions = (webp: Uint8Array): { width: number; height: number } => {
    const chunks = parseRiffChunks(webp);

    const vp8x = chunks.find((c) => c.fourCC === 'VP8X');
    if (vp8x) {
        return { width: readUint24LE(vp8x.payload, 4) + 1, height: readUint24LE(vp8x.payload, 7) + 1 };
    }

    const vp8l = chunks.find((c) => c.fourCC === 'VP8L');
    if (vp8l) {
        // Signature byte (0x2f) then 14-bit (width-1), 14-bit (height-1), read LSB-first.
        const p = vp8l.payload;
        const bits = (p[1] | (p[2] << 8) | (p[3] << 16) | (p[4] << 24)) >>> 0;
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }

    const vp8 = chunks.find((c) => c.fourCC === 'VP8 ');
    if (vp8) {
        // 3-byte frame tag + 3-byte start code (0x9d 0x01 0x2a), then 14-bit width and 14-bit height.
        const p = vp8.payload;
        return { width: ((p[7] << 8) | p[6]) & 0x3fff, height: ((p[9] << 8) | p[8]) & 0x3fff };
    }

    throw new Error('Could not read WebP dimensions: no VP8X/VP8L/VP8 chunk');
};

// The image bitstream sub-chunks of a static WebP, copied verbatim (header + payload + pad byte) so
// they can be embedded inside an ANMF frame: an optional ALPH chunk followed by the VP8/VP8L chunk.
interface FrameBitstream {
    readonly bytes: Uint8Array;
    readonly hasAlpha: boolean;
}

const extractFrameBitstream = (webp: Uint8Array): FrameBitstream => {
    const chunks = parseRiffChunks(webp);
    const alph = chunks.find((c) => c.fourCC === 'ALPH');
    const image = chunks.find((c) => c.fourCC === 'VP8 ' || c.fourCC === 'VP8L');

    if (!image) {
        throw new Error('Static WebP frame is missing a VP8/VP8L image chunk');
    }

    const segments: Uint8Array[] = [];

    if (alph) {
        segments.push(webp.subarray(alph.start, alph.end));
    }

    segments.push(webp.subarray(image.start, image.end));

    // VP8L can carry alpha intrinsically; a separate ALPH chunk pairs with lossy VP8.
    const hasAlpha = alph !== undefined || image.fourCC === 'VP8L';
    return { bytes: concat(segments), hasAlpha };
};

const concat = (segments: Uint8Array[]): Uint8Array => {
    const total = segments.reduce((sum, s) => sum + s.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;

    for (const s of segments) {
        out.set(s, offset);
        offset += s.length;
    }

    return out;
};

// Build a complete RIFF chunk (FourCC + size + payload + pad byte when the payload size is odd).
const buildChunk = (fourCC: string, payload: Uint8Array): Uint8Array => {
    const padded = payload.length & 1;
    const out = new Uint8Array(8 + payload.length + padded);
    out.set(fourCCBytes(fourCC), 0);
    writeUint32LE(out, 4, payload.length);
    out.set(payload, 8);
    return out;
};

// Mux ordered static-WebP frames into a single animated WebP container, sized to the first frame and
// looping forever.
export const muxAnimatedWebp = (frames: AnimatedWebpFrame[]): Uint8Array => {
    if (frames.length === 0) {
        throw new Error('Cannot mux an animated WebP with zero frames');
    }

    const { width, height } = readWebpDimensions(frames[0].data);
    const bitstreams = frames.map((frame) => extractFrameBitstream(frame.data));
    const anyAlpha = bitstreams.some((b) => b.hasAlpha);

    // VP8X: flags byte (Animation = 0x02, Alpha = 0x10) + 3 reserved bytes + 24-bit (w-1) + 24-bit (h-1).
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x02 | (anyAlpha ? 0x10 : 0x00);
    writeUint24LE(vp8x, 4, width - 1);
    writeUint24LE(vp8x, 7, height - 1);

    // ANIM: 32-bit background color (0 = transparent) + 16-bit loop count (0 = loop forever), all zero.
    const anim = new Uint8Array(6);

    const segments: Uint8Array[] = [buildChunk('VP8X', vp8x), buildChunk('ANIM', anim)];

    for (let i = 0; i < frames.length; i++) {
        // ANMF payload: 16-byte frame header followed by the frame's image sub-chunks.
        const header = new Uint8Array(16);
        writeUint24LE(header, 0, 0); // Frame X (in units of 2px)
        writeUint24LE(header, 3, 0); // Frame Y (in units of 2px)
        writeUint24LE(header, 6, width - 1); // Frame width minus one
        writeUint24LE(header, 9, height - 1); // Frame height minus one
        writeUint24LE(header, 12, Math.max(0, Math.round(frames[i].durationMs))); // Duration (ms)
        header[15] = 0x00; // Blend with previous frame, no disposal

        segments.push(buildChunk('ANMF', concat([header, bitstreams[i].bytes])));
    }

    const body = concat(segments);

    // RIFF header: 'RIFF' + (file size - 8) + 'WEBP', followed by the body chunks.
    const out = new Uint8Array(12 + body.length);
    out.set(fourCCBytes('RIFF'), 0);
    writeUint32LE(out, 4, 4 + body.length); // size of everything after this field ('WEBP' + body)
    out.set(fourCCBytes('WEBP'), 8);
    out.set(body, 12);
    return out;
};
