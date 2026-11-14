const byteRadix = 256;
const defaultWindowSize = 64 * 1024;

/**
 * Reads bytes, big-endian unsigned integers, and ASCII strings from a {@link Blob} through a
 * cached window (64 KiB by default). Container walkers skip packet payloads by offset rather
 * than pulling an entire media file into memory.
 */
export default class ByteReader {
    private readonly _blob: Blob;
    private readonly _windowSize: number;
    private _window: Uint8Array = new Uint8Array(0);
    private _windowOffset = 0;

    constructor(
        blob: Blob,
        windowSize: number = defaultWindowSize,
        private readonly signal?: AbortSignal
    ) {
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
        this.signal?.throwIfAborted();
        if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(length) ||
            offset < 0 ||
            length < 0 ||
            offset + length > this._blob.size
        ) {
            return;
        }
        if (length === 0) return new Uint8Array(0);
        if (offset < this._windowOffset || offset + length > this._windowOffset + this._window.length) {
            const end = Math.min(this._blob.size, offset + Math.max(length, this._windowSize));
            this._window = new Uint8Array(await this._blob.slice(offset, end).arrayBuffer());
            this._windowOffset = offset;
            this.signal?.throwIfAborted();
        }
        const start = offset - this._windowOffset;
        return this._window.subarray(start, start + length);
    }

    /**
     * Reads an unsigned big-endian integer. Values wider than 32 bits are accumulated with
     * multiplication rather than bit operations, which would truncate them.
     */
    async unsignedInt(offset: number, length: number): Promise<number | undefined> {
        if (length > 8) return;
        const bytes = await this.bytes(offset, length);
        if (bytes === undefined) return;
        let value = 0;
        for (const byte of bytes) value = value * byteRadix + byte;
        return value;
    }

    async utf8(offset: number, length: number): Promise<string> {
        if (length > defaultWindowSize) throw new Error('Media metadata string is too large');
        const bytes = await this.bytes(offset, length);
        if (!bytes) throw new Error('Truncated media metadata');
        return new TextDecoder().decode(bytes).replace(/\0+$/, '');
    }

    async ascii(offset: number, length: number): Promise<string | undefined> {
        const bytes = await this.bytes(offset, length);
        if (bytes === undefined) return;
        let text = '';
        for (const byte of bytes) text += String.fromCharCode(byte);
        return text;
    }
}
