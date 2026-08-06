const defaultWindowSize = 64 * 1024;

/**
 * Reads ranges out of a {@link Blob} through a sliding window so that container headers can be
 * walked without pulling an entire media file into memory.
 */
export default class ByteReader {
    private readonly _blob: Blob;
    private readonly _windowSize: number;
    private _window: Uint8Array = new Uint8Array(0);
    private _windowOffset = 0;

    constructor(blob: Blob, windowSize: number = defaultWindowSize) {
        this._blob = blob;
        this._windowSize = windowSize;
    }

    get size() {
        return this._blob.size;
    }

    /**
     * @returns the requested bytes, or undefined when they extend past the end of the blob.
     */
    async bytes(offset: number, length: number): Promise<Uint8Array | undefined> {
        if (offset < 0 || length < 0 || offset + length > this._blob.size) {
            return undefined;
        }

        if (length === 0) {
            return new Uint8Array(0);
        }

        if (offset < this._windowOffset || offset + length > this._windowOffset + this._window.length) {
            const end = Math.min(this._blob.size, offset + Math.max(length, this._windowSize));
            this._window = new Uint8Array(await this._blob.slice(offset, end).arrayBuffer());
            this._windowOffset = offset;

            if (this._window.length < length) {
                return undefined;
            }
        }

        const start = offset - this._windowOffset;
        return this._window.subarray(start, start + length);
    }

    /**
     * Reads an unsigned big-endian integer. Values wider than 32 bits are accumulated with
     * multiplication rather than bit operations, which would truncate them.
     */
    async unsignedInt(offset: number, length: number): Promise<number | undefined> {
        const bytes = await this.bytes(offset, length);

        if (bytes === undefined) {
            return undefined;
        }

        let value = 0;

        for (const byte of bytes) {
            value = value * 256 + byte;
        }

        return value;
    }

    async ascii(offset: number, length: number): Promise<string | undefined> {
        const bytes = await this.bytes(offset, length);

        if (bytes === undefined) {
            return undefined;
        }

        let text = '';

        for (const byte of bytes) {
            text += String.fromCharCode(byte);
        }

        return text;
    }
}
