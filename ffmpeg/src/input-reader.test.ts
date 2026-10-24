import { createInputReader } from '@project/ffmpeg';

// Model the synchronous browser file boundary with bytes, without mocking the reader.
class MemoryBlob extends Blob {
    constructor(readonly contents: Uint8Array<ArrayBuffer>) {
        super([contents]);
    }
    override slice(start = 0, end = this.size) {
        return new MemoryBlob(this.contents.slice(start, end));
    }
}
const readSlice = (blob: Blob) => (blob as MemoryBlob).contents.buffer;

it('reads and seeks bounded file slices, including a short EOF read', () => {
    const reader = createInputReader(new MemoryBlob(new Uint8Array([0, 1, 2, 3, 4, 5])), {
        maximumReadBytes: 3,
        readSlice,
    });
    expect(reader.size).toBe(6);
    expect([...reader.readAt(2, 3)]).toEqual([2, 3, 4]);
    expect([...reader.readAt(0, 2)]).toEqual([0, 1]);
    expect([...reader.readAt(5, 3)]).toEqual([5]);
    expect(reader.readAt(6, 3)).toHaveLength(0);
    expect(reader.readAt(100, 3)).toHaveLength(0);
    expect(reader.readAt(1, 0)).toHaveLength(0);
});

it.each([
    [-1, 1],
    [0.5, 1],
    [Number.MAX_SAFE_INTEGER + 1, 1],
    [0, -1],
    [0, 4],
    [0, Infinity],
    [0, 0.5],
])('rejects invalid read bounds (%s, %s) before touching the file', (offset, length) => {
    const read = jest.fn(readSlice);
    const reader = createInputReader(new MemoryBlob(new Uint8Array([1, 2, 3])), {
        maximumReadBytes: 3,
        readSlice: read,
    });
    expect(() => reader.readAt(offset, length)).toThrow(RangeError);
    expect(read).not.toHaveBeenCalled();
});

it('keeps offsets above 4 GiB precise and reads only the requested range', () => {
    const offset = 2 ** 32 + 1;
    const slice = jest.fn(() => new MemoryBlob(new Uint8Array([7, 8, 9])));
    const file = { size: offset + 3, slice } as unknown as Blob;
    const reader = createInputReader(file, { readSlice });
    expect([...reader.readAt(offset, 64 * 1024)]).toEqual([7, 8, 9]);
    expect(slice).toHaveBeenCalledWith(offset, offset + 3);
    expect(() => reader.readAt(0, 64 * 1024 + 1)).toThrow(RangeError);
    expect(slice).toHaveBeenCalledTimes(1);
});

it('rejects an incomplete host file read', () => {
    const reader = createInputReader(new MemoryBlob(new Uint8Array([1, 2, 3])), {
        readSlice: () => new ArrayBuffer(1),
    });
    expect(() => reader.readAt(0, 3)).toThrow('unexpected number of bytes');
});

it.each([0, -1, Infinity, 0.5])('rejects invalid maximum read size %s', (maximumReadBytes) => {
    expect(() => createInputReader(new Blob(), { maximumReadBytes })).toThrow(RangeError);
});
