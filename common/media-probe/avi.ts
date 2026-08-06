import ByteReader from './byte-reader';

const headerSize = 8;
const listTypeSize = 4;
const audioStream = 'auds';

// Guards against walking forever through a file that isn't shaped the way we expect.
const maxChunks = 4096;

// wFormatTag values from WAVEFORMATEX, mapped to the codec names this module reports.
const waveFormatTags: { [tag: number]: string } = {
    0x0001: 'pcm',
    0x0003: 'pcm',
    0x0055: 'mp3',
    0x2000: 'ac3',
    0x2001: 'dts',
    0x00ff: 'aac',
    0xa106: 'aac',
    0xf1ac: 'flac',
};

interface Chunk {
    id: string;
    dataOffset: number;
    end: number;
}

const unsignedIntLe = async (reader: ByteReader, offset: number, length: number) => {
    const bytes = await reader.bytes(offset, length);

    if (bytes === undefined) {
        return undefined;
    }

    let value = 0;

    for (let i = bytes.length - 1; i >= 0; --i) {
        value = value * 256 + bytes[i];
    }

    return value;
};

const readChunk = async (reader: ByteReader, offset: number, limit: number): Promise<Chunk | undefined> => {
    const id = await reader.ascii(offset, 4);
    const size = await unsignedIntLe(reader, offset + 4, 4);

    if (id === undefined || size === undefined) {
        return undefined;
    }

    const dataOffset = offset + headerSize;

    if (dataOffset + size > limit) {
        return undefined;
    }

    return { id, dataOffset, end: dataOffset + size };
};

// RIFF chunks are padded to an even number of bytes, and the padding is not counted in the size.
const nextChunkOffset = (chunk: Chunk) => chunk.end + (chunk.end % 2);

const streamListCodec = async (reader: ByteReader, strl: Chunk) => {
    let offset = strl.dataOffset + listTypeSize;
    let isAudio = false;
    let formatOffset: number | undefined;

    while (offset < strl.end) {
        const chunk = await readChunk(reader, offset, strl.end);

        if (chunk === undefined) {
            break;
        }

        if (chunk.id === 'strh') {
            isAudio = (await reader.ascii(chunk.dataOffset, 4)) === audioStream;
        } else if (chunk.id === 'strf') {
            formatOffset = chunk.dataOffset;
        }

        offset = nextChunkOffset(chunk);
    }

    if (!isAudio || formatOffset === undefined) {
        return undefined;
    }

    const formatTag = await unsignedIntLe(reader, formatOffset, 2);
    return formatTag === undefined ? undefined : (waveFormatTags[formatTag] ?? `wave-${formatTag}`);
};

const listCodecs = async (reader: ByteReader, list: Chunk, codecs: string[]) => {
    let offset = list.dataOffset + listTypeSize;
    let chunks = 0;

    while (offset < list.end && ++chunks <= maxChunks) {
        const chunk = await readChunk(reader, offset, list.end);

        if (chunk === undefined) {
            break;
        }

        if (chunk.id === 'LIST') {
            const listType = await reader.ascii(chunk.dataOffset, listTypeSize);

            if (listType === 'strl') {
                const codec = await streamListCodec(reader, chunk);

                if (codec !== undefined) {
                    codecs.push(codec);
                }
            } else if (listType === 'hdrl') {
                await listCodecs(reader, chunk, codecs);
            }
        }

        offset = nextChunkOffset(chunk);
    }
};

/**
 * @returns codec names of the audio streams in an AVI file, in stream order.
 */
export const aviAudioCodecs = async (reader: ByteReader): Promise<string[] | undefined> => {
    const riff = await readChunk(reader, 0, reader.size);

    if (riff === undefined || riff.id !== 'RIFF') {
        return undefined;
    }

    const codecs: string[] = [];
    await listCodecs(reader, riff, codecs);
    return codecs;
};
