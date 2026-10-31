import { ffmpegExecutables } from '@project/ffmpeg/assets';
import project from '@project/ffmpeg/project';

const blockSize = 512;
const ustarHeader = {
    name: { offset: 0, length: 100 },
    size: { offset: 124, length: 12 },
    checksum: { offset: 148, length: 8 },
    type: { offset: 156 },
    magic: { offset: 257, length: 6 },
    prefix: { offset: 345, length: 155 },
};
const ustarMagic = 'ustar';
const asciiSpace = 0x20;
const regularFileType = '0'.charCodeAt(0);
const alternateRegularFileType = 0;
const directoryType = '5'.charCodeAt(0);
const octalRadix = 8;
const textDecoder = new TextDecoder();

const readString = (header: Uint8Array, offset: number, length: number) => {
    const field = header.subarray(offset, offset + length);
    const end = field.indexOf(0);
    return textDecoder.decode(end === -1 ? field : field.subarray(0, end));
};

const readOctal = (header: Uint8Array, offset: number, length: number) => {
    const text = readString(header, offset, length).trim();
    if (!/^[0-7]+$/.test(text)) throw new Error('Invalid FFmpeg runtime archive header');
    return parseInt(text, octalRadix);
};

const hasValidChecksum = (header: Uint8Array) => {
    let sum = 0;
    const checksum = ustarHeader.checksum;
    // The checksum field itself is counted as spaces.
    for (let index = 0; index < blockSize; index++) {
        sum += index >= checksum.offset && index < checksum.offset + checksum.length ? asciiSpace : header[index];
    }
    return sum === readOctal(header, checksum.offset, checksum.length);
};

/**
 * Read regular files from an uncompressed ustar archive. Releases pin `tar --format=ustar`,
 * so long-name and pax extension entries are rejected rather than interpreted.
 */
const readTarFiles = (archive: Uint8Array<ArrayBuffer>): Map<string, Uint8Array<ArrayBuffer>> => {
    const files = new Map<string, Uint8Array<ArrayBuffer>>();
    let offset = 0;
    while (offset + blockSize <= archive.byteLength) {
        const header = archive.subarray(offset, offset + blockSize);
        if (header.every((byte) => byte === 0)) return files;
        if (
            readString(header, ustarHeader.magic.offset, ustarHeader.magic.length) !== ustarMagic ||
            !hasValidChecksum(header)
        ) {
            throw new Error('Invalid FFmpeg runtime archive header');
        }
        const name = readString(header, ustarHeader.name.offset, ustarHeader.name.length);
        const prefix = readString(header, ustarHeader.prefix.offset, ustarHeader.prefix.length);
        const path = prefix ? `${prefix}/${name}` : name;
        const size = readOctal(header, ustarHeader.size.offset, ustarHeader.size.length);
        const type = header[ustarHeader.type.offset];
        const dataStart = offset + blockSize;
        const dataEnd = dataStart + size;
        if (dataEnd > archive.byteLength) throw new Error('The FFmpeg runtime archive is truncated');
        if (type === regularFileType || type === alternateRegularFileType) {
            if (files.has(path)) throw new Error(`Duplicate FFmpeg runtime archive entry: ${path}`);
            files.set(path, archive.subarray(dataStart, dataEnd));
        } else if (type !== directoryType) {
            throw new Error(`Unsupported FFmpeg runtime archive entry: ${path}`);
        }
        offset = dataStart + Math.ceil(size / blockSize) * blockSize;
    }
    throw new Error('The FFmpeg runtime archive is truncated');
};

export type FfmpegRuntimeExecutables = { worker: Blob; core: Blob; wasm: Blob };

/** Extract the executables from a verified archive rooted at its release artifact basename. */
export const unpackFfmpegRuntime = async (archive: Blob, runtimeVersion: string): Promise<FfmpegRuntimeExecutables> => {
    const tar = new Uint8Array(
        await new Response(archive.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    );
    const files = readTarFiles(tar);
    const runtimeRoot = project.releases.ffmpeg.artifact.replaceAll('{{version}}', runtimeVersion);
    const executable = ({ filename, type }: { filename: string; type: string }) => {
        const bytes = files.get(`${runtimeRoot}/${filename}`);
        if (bytes === undefined) throw new Error(`The FFmpeg runtime archive is missing ${filename}`);
        return new Blob([bytes], { type });
    };
    return {
        worker: executable(ffmpegExecutables.worker),
        core: executable(ffmpegExecutables.core),
        wasm: executable(ffmpegExecutables.wasm),
    };
};
