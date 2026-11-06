import { ffmpegExecutables } from '@project/ffmpeg/assets';

const blockSize = 512;
const textDecoder = new TextDecoder();

const readString = (header: Uint8Array, offset: number, length: number) => {
    const field = header.subarray(offset, offset + length);
    const end = field.indexOf(0);
    return textDecoder.decode(end === -1 ? field : field.subarray(0, end));
};

const readOctal = (header: Uint8Array, offset: number, length: number) => {
    const text = readString(header, offset, length).trim();
    if (!/^[0-7]+$/.test(text)) throw new Error('Invalid FFmpeg runtime archive header');
    return parseInt(text, 8);
};

const hasValidChecksum = (header: Uint8Array) => {
    let sum = 0;
    // The checksum field itself is counted as spaces.
    for (let index = 0; index < blockSize; index++) sum += index >= 148 && index < 156 ? 32 : header[index];
    return sum === readOctal(header, 148, 8);
};

/**
 * Read regular files from an uncompressed ustar archive. Releases pin `tar --format=ustar`,
 * so long-name and pax extension entries are rejected rather than interpreted.
 */
export const readTarFiles = (archive: Uint8Array<ArrayBuffer>): Map<string, Uint8Array<ArrayBuffer>> => {
    const files = new Map<string, Uint8Array<ArrayBuffer>>();
    let offset = 0;
    while (offset + blockSize <= archive.byteLength) {
        const header = archive.subarray(offset, offset + blockSize);
        if (header.every((byte) => byte === 0)) return files;
        if (readString(header, 257, 6) !== 'ustar' || !hasValidChecksum(header)) {
            throw new Error('Invalid FFmpeg runtime archive header');
        }
        const name = readString(header, 0, 100);
        const prefix = readString(header, 345, 155);
        const path = prefix ? `${prefix}/${name}` : name;
        const size = readOctal(header, 124, 12);
        const type = header[156];
        const dataStart = offset + blockSize;
        const dataEnd = dataStart + size;
        if (dataEnd > archive.byteLength) throw new Error('The FFmpeg runtime archive is truncated');
        // '0' and NUL are regular files; '5' is a directory.
        if (type === 0x30 || type === 0) {
            if (files.has(path)) throw new Error(`Duplicate FFmpeg runtime archive entry: ${path}`);
            files.set(path, archive.subarray(dataStart, dataEnd));
        } else if (type !== 0x35) {
            throw new Error(`Unsupported FFmpeg runtime archive entry: ${path}`);
        }
        offset = dataStart + Math.ceil(size / blockSize) * blockSize;
    }
    throw new Error('The FFmpeg runtime archive is truncated');
};

export type FfmpegRuntimeExecutables = { worker: Blob; core: Blob; wasm: Blob };

/** Extract the executables from a verified `<runtimeVersion>/...` runtime archive. */
export const unpackFfmpegRuntime = async (archive: Blob, runtimeVersion: string): Promise<FfmpegRuntimeExecutables> => {
    const tar = new Uint8Array(
        await new Response(archive.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    );
    const files = readTarFiles(tar);
    const executable = ({ filename, type }: { filename: string; type: string }) => {
        const bytes = files.get(`${runtimeVersion}/${filename}`);
        if (bytes === undefined) throw new Error(`The FFmpeg runtime archive is missing ${filename}`);
        return new Blob([bytes], { type });
    };
    return {
        worker: executable(ffmpegExecutables.worker),
        core: executable(ffmpegExecutables.core),
        wasm: executable(ffmpegExecutables.wasm),
    };
};
