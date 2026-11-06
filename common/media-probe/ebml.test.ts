/** @jest-environment node */
import { expect, it } from '@jest/globals';
import ByteReader from '@project/common/media-probe/byte-reader';
import { findEbmlElement, readEbmlElement, readEbmlVarInt } from '@project/common/media-probe/ebml';

const readerFor = (bytes: number[]) => new ByteReader(new Blob([new Uint8Array(bytes)]));

it('distinguishes size values from element IDs whose marker bits are retained', async () => {
    expect(await readEbmlVarInt(readerFor([0x40, 0x80]), 0)).toEqual({ value: 128, length: 2, unknown: false });
    expect(await readEbmlVarInt(readerFor([0x1a, 0x45, 0xdf, 0xa3]), 0, true)).toEqual({
        value: 0x1a45dfa3,
        length: 4,
        unknown: false,
    });
});

it.each([[], [0], [0x40], [0x1a, 0x45, 0xdf]].map((bytes) => ({ bytes })))(
    'rejects invalid or truncated variable integers: $bytes',
    async ({ bytes }) => {
        expect(await readEbmlVarInt(readerFor(bytes), 0)).toBeUndefined();
    }
);

it('rejects an element ID longer than four bytes', async () => {
    expect(await readEbmlVarInt(readerFor([0x08, 1, 2, 3, 4]), 0, true)).toBeUndefined();
});

it.each([[0xff], [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]].map((size) => ({ size })))(
    'keeps unknown sizes explicit and bounds their payload to the enclosing element: $size',
    async ({ size }) => {
        const bytes = [0x18, 0x53, 0x80, 0x67, ...size, 1, 2, 3];
        const element = await readEbmlElement(readerFor(bytes), 0, bytes.length);
        expect(element).toEqual({
            id: 0x18538067,
            dataOffset: 4 + size.length,
            dataSize: 3,
            end: bytes.length,
            unknown: true,
        });
    }
);

it.each([[0xa3, 0x83, 1], [0xa3], [0xa3, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]].map((bytes) => ({ bytes })))(
    'rejects incomplete or unsafe element sizes: $bytes',
    async ({ bytes }) => {
        expect(await readEbmlElement(readerFor(bytes), 0, bytes.length)).toBeUndefined();
    }
);

it('finds sibling elements by skipping the preceding payload', async () => {
    const reader = readerFor([0xa3, 0x83, 1, 2, 3, 0xe7, 0x81, 7]);
    expect(await findEbmlElement(reader, 0xe7)).toEqual({
        id: 0xe7,
        dataOffset: 7,
        dataSize: 1,
        end: 8,
        unknown: false,
    });
    expect(await findEbmlElement(reader, 0xe8)).toBeUndefined();
});
