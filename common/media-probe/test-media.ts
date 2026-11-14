// Tiny metadata-only containers for discovery tests. No media payloads or FFmpeg required.
import { TextEncoder } from 'util';

export const concat = (...parts: Uint8Array[]) => Buffer.concat(parts);
export const utf8 = (text: string) => new TextEncoder().encode(text);
export const element = (id: string, ...parts: Uint8Array[]) => {
    const bytes = concat(...parts);
    if (bytes.length >= 0x3fff) throw new Error('Test EBML element is too large');
    const size = bytes.length < 0x7f ? [0x80 | bytes.length] : [0x40 | (bytes.length >> 8), bytes.length & 255];
    return concat(Buffer.from(id, 'hex'), Buffer.from(size), bytes);
};
export const mkvTrack = (type: number, codec: string, ...metadata: Uint8Array[]) =>
    element('ae', element('83', Buffer.from([type])), element('86', utf8(codec)), ...metadata);
export const mkv = (...tracks: Uint8Array[]) =>
    concat(element('1a45dfa3'), element('18538067', element('1654ae6b', ...tracks)));
export const box = (type: string, ...parts: Uint8Array[]) => {
    const bytes = concat(...parts);
    const header = Buffer.alloc(8);
    header.writeUInt32BE(bytes.length + 8);
    header.write(type, 4, 'latin1');
    return concat(header, bytes);
};
export const mp4Track = (handler: string, format: string, version = 0, id = 1) => {
    const tkhd = Buffer.alloc(version === 1 ? 24 : 16);
    tkhd[0] = version;
    tkhd.writeUInt32BE(id, version === 1 ? 20 : 12);
    const mdhd = Buffer.alloc(version === 1 ? 36 : 24);
    mdhd[0] = version;
    mdhd.writeUInt16BE((10 << 10) | (16 << 5) | 14, version === 1 ? 32 : 20); // jpn
    return box(
        'trak',
        box('tkhd', tkhd),
        box(
            'mdia',
            box('mdhd', mdhd),
            box('hdlr', Buffer.alloc(8), utf8(handler), Buffer.alloc(12), utf8('日本語\0')),
            box('minf', box('stbl', box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box(format))))
        )
    );
};
