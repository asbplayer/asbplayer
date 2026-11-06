/** @jest-environment node */
import ByteReader from '@project/common/media-probe/byte-reader';

it('reads unsigned integers wider than 32 bits without truncating them', async () => {
    const reader = new ByteReader(new Blob([new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc])]));
    expect(await reader.unsignedInt(0, 6)).toBe(0x123456789abc);
});

it('reads across cache boundaries while keeping small reads bounded', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const blob = new Blob([bytes]);
    const read = jest.spyOn(blob, 'slice');
    const reader = new ByteReader(blob, 8);
    expect(await reader.bytes(6, 4)).toEqual(bytes.slice(6, 10));
    expect(await reader.bytes(7, 3)).toEqual(bytes.slice(7, 10));
    expect(await reader.bytes(14, 4)).toEqual(bytes.slice(14, 18));
    expect(read.mock.calls.length).toBe(2);
    expect(read.mock.calls.every(([start, end]) => end! - start! <= 8)).toBe(true);
});

it('supports a requested field larger than its prefetch window', async () => {
    const reader = new ByteReader(new Blob(['audio-codec']), 4);
    expect(await reader.ascii(0, 11)).toBe('audio-codec');
    expect(await reader.ascii(6, 5)).toBe('codec');
});

it.each([
    [-1, 1],
    [0, -1],
    [2, 2],
    [4, 1],
])('rejects an out-of-bounds read at %i with length %i', async (offset, length) => {
    const reader = new ByteReader(new Blob(['abc']));
    expect(await reader.bytes(offset, length)).toBeUndefined();
});
