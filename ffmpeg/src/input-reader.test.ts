import { createInputReader } from '@project/ffmpeg';

const maximumReadBytes = 64 * 1024;
const readAheadBytes = 4 * 1024 * 1024;

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
const bytesAt = (offset: number, length: number) => Uint8Array.from({ length }, (_, index) => (offset + index) % 251);

it('reads and seeks bounded file slices, including a short EOF read', () => {
    const reader = createInputReader(new MemoryBlob(new Uint8Array([0, 1, 2, 3, 4, 5])), readSlice);
    expect(reader.size).toBe(6);
    expect([...reader.readAt(2, 3)]).toEqual([2, 3, 4]);
    expect([...reader.readAt(0, 2)]).toEqual([0, 1]);
    expect([...reader.readAt(5, maximumReadBytes)]).toEqual([5]);
    expect(reader.readAt(6, 3)).toHaveLength(0);
    expect(reader.readAt(100, 3)).toHaveLength(0);
    expect(reader.readAt(1, 0)).toHaveLength(0);
});

it.each([
    [-1, 1],
    [0.5, 1],
    [Number.MAX_SAFE_INTEGER + 1, 1],
    [0, -1],
    [0, maximumReadBytes + 1],
    [0, Infinity],
    [0, 0.5],
])('rejects invalid read bounds (%s, %s) before touching the file', (offset, length) => {
    const read = jest.fn(readSlice);
    const reader = createInputReader(new MemoryBlob(new Uint8Array([1, 2, 3])), read);
    expect(() => reader.readAt(offset, length)).toThrow(RangeError);
    expect(read).not.toHaveBeenCalled();
});

it('keeps offsets above 4 GiB precise and clips read-ahead at EOF', () => {
    const offset = 2 ** 32 + 1;
    const slice = jest.fn(() => new MemoryBlob(new Uint8Array([7, 8, 9])));
    const file = { size: offset + 3, slice } as unknown as Blob;
    const reader = createInputReader(file, readSlice);
    expect([...reader.readAt(offset, maximumReadBytes)]).toEqual([7, 8, 9]);
    expect(slice).toHaveBeenCalledWith(offset, offset + 3);
    expect(() => reader.readAt(0, maximumReadBytes + 1)).toThrow(RangeError);
    expect(slice).toHaveBeenCalledTimes(1);
});

it('rejects an incomplete host file read', () => {
    const reader = createInputReader(new MemoryBlob(new Uint8Array([1, 2, 3])), () => new ArrayBuffer(1));
    expect(() => reader.readAt(0, 3)).toThrow('unexpected number of bytes');
});

it('reuses the 4 MiB window across 64 KiB reads and seeks, then clips read-ahead at EOF', () => {
    const file = new MemoryBlob(bytesAt(0, 2 * readAheadBytes + 32));
    const reads: number[] = [];
    const reader = createInputReader(file, (slice) => {
        reads.push(slice.size);
        return readSlice(slice);
    });
    const first = reader.readAt(0, 3);
    expect(first).toEqual(bytesAt(0, 3));
    expect(reader.readAt(3, maximumReadBytes)).toEqual(bytesAt(3, maximumReadBytes));
    expect(reader.readAt(1, 2)).toEqual(bytesAt(1, 2));
    expect(reads).toEqual([readAheadBytes]);

    const crossing = readAheadBytes - 2;
    expect(reader.readAt(crossing, 4)).toEqual(bytesAt(crossing, 4));
    expect(reader.readAt(readAheadBytes + 17, 7)).toEqual(bytesAt(readAheadBytes + 17, 7));
    expect(reads).toEqual([readAheadBytes, readAheadBytes]);

    expect(reader.readAt(2, 4)).toEqual(bytesAt(2, 4));
    expect(reader.readAt(file.size - 2, 4)).toEqual(bytesAt(file.size - 2, 2));
    expect(reader.readAt(file.size, maximumReadBytes)).toHaveLength(0);
    expect(reads).toEqual([readAheadBytes, readAheadBytes, readAheadBytes, 2]);
    expect(first).toEqual(bytesAt(0, 3));
});

it('keeps read-ahead bounded and accurate when seeking above 4 GiB', () => {
    const start = 2 ** 32 + 1;
    const end = start + readAheadBytes + 40;
    const slices: [number, number][] = [];
    const file = {
        size: end,
        slice: (offset: number, limit: number) => {
            slices.push([offset, limit]);
            return new MemoryBlob(bytesAt(offset, limit - offset));
        },
    } as unknown as Blob;
    const reader = createInputReader(file, readSlice);
    expect(reader.readAt(start, 2)).toEqual(bytesAt(start, 2));
    expect(reader.readAt(start + 3, 2)).toEqual(bytesAt(start + 3, 2));
    const crossing = start + readAheadBytes - 2;
    expect(reader.readAt(crossing, 4)).toEqual(bytesAt(crossing, 4));
    expect(slices).toEqual([
        [start, start + readAheadBytes],
        [crossing, end],
    ]);
});
