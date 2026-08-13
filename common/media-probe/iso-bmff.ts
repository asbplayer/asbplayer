import ByteReader from './byte-reader';

const headerSize = 8;
const largeSizeLength = 8;
const soundHandler = 'soun';

// Guards against walking forever through a file that isn't shaped the way we expect.
const maxBoxes = 4096;

interface Box {
    type: string;
    dataOffset: number;
    end: number;
}

const readBox = async (reader: ByteReader, offset: number, limit: number): Promise<Box | undefined> => {
    const size = await reader.unsignedInt(offset, 4);
    const type = await reader.ascii(offset + 4, 4);

    if (size === undefined || type === undefined) {
        return undefined;
    }

    let dataOffset = offset + headerSize;
    let end: number;

    if (size === 1) {
        const largeSize = await reader.unsignedInt(dataOffset, largeSizeLength);

        if (largeSize === undefined || largeSize < headerSize + largeSizeLength) {
            return undefined;
        }

        dataOffset += largeSizeLength;
        end = offset + largeSize;
    } else if (size === 0) {
        // A zero size means the box runs to the end of the enclosing box.
        end = limit;
    } else if (size < headerSize) {
        return undefined;
    } else {
        end = offset + size;
    }

    if (dataOffset > end || end > limit) {
        return undefined;
    }

    return { type, dataOffset, end };
};

/**
 * Walks the boxes between offset and limit, handing each to the visitor. The visitor returning a
 * value stops the walk.
 */
const forEachBox = async <T>(
    reader: ByteReader,
    offset: number,
    limit: number,
    visit: (box: Box) => Promise<T | undefined>
): Promise<T | undefined> => {
    let boxes = 0;

    while (offset < limit && ++boxes <= maxBoxes) {
        const box = await readBox(reader, offset, limit);

        if (box === undefined) {
            return undefined;
        }

        const result = await visit(box);

        if (result !== undefined) {
            return result;
        }

        offset = box.end;
    }

    return undefined;
};

const findBox = (reader: ByteReader, type: string, offset: number, limit: number) =>
    forEachBox(reader, offset, limit, async (box) => (box.type === type ? box : undefined));

const isAudioTrack = async (reader: ByteReader, mdia: Box) => {
    const hdlr = await findBox(reader, 'hdlr', mdia.dataOffset, mdia.end);

    if (hdlr === undefined) {
        return false;
    }

    // FullBox version/flags, then pre_defined, then the handler type.
    return (await reader.ascii(hdlr.dataOffset + 8, 4)) === soundHandler;
};

const sampleEntryFormat = async (reader: ByteReader, mdia: Box) => {
    const minf = await findBox(reader, 'minf', mdia.dataOffset, mdia.end);
    const stbl = minf && (await findBox(reader, 'stbl', minf.dataOffset, minf.end));
    const stsd = stbl && (await findBox(reader, 'stsd', stbl.dataOffset, stbl.end));

    if (!stsd) {
        return undefined;
    }

    // FullBox version/flags, then entry_count, then the first sample entry.
    const entry = await readBox(reader, stsd.dataOffset + 8, stsd.end);
    return entry?.type;
};

/**
 * @returns sample entry formats of the audio tracks in an ISO base media file, in track order.
 */
export const isoBmffAudioSampleFormats = async (reader: ByteReader): Promise<string[] | undefined> => {
    // moov is commonly at the end of the file, so this walks top-level boxes by size rather than
    // reading through them.
    const moov = await findBox(reader, 'moov', 0, reader.size);

    if (moov === undefined) {
        return undefined;
    }

    const formats: string[] = [];

    await forEachBox(reader, moov.dataOffset, moov.end, async (trak) => {
        if (trak.type !== 'trak') {
            return undefined;
        }

        const mdia = await findBox(reader, 'mdia', trak.dataOffset, trak.end);

        if (mdia !== undefined && (await isAudioTrack(reader, mdia))) {
            const format = await sampleEntryFormat(reader, mdia);

            if (format !== undefined) {
                formats.push(format);
            }
        }

        return undefined;
    });

    return formats;
};
