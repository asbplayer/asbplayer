import ByteReader from './byte-reader';

// EBML element IDs, with their marker bits left intact as they appear on disk.
const idSegment = 0x18538067;
const idTracks = 0x1654ae6b;
const idTrackEntry = 0xae;
const idTrackType = 0x83;
const idCodecId = 0x86;

const trackTypeAudio = 2;

// Guards against walking forever through a file that isn't shaped the way we expect.
const maxElements = 4096;

interface VarInt {
    value: number;
    length: number;
    unknown: boolean;
}

interface Element {
    id: number;
    dataOffset: number;
    dataSize: number;
    end: number;
}

/**
 * Reads an EBML variable length integer. Element IDs keep their marker bits; sizes drop them.
 */
const readVarInt = async (reader: ByteReader, offset: number, keepMarker: boolean): Promise<VarInt | undefined> => {
    const first = await reader.bytes(offset, 1);

    if (first === undefined || first[0] === 0) {
        return undefined;
    }

    let length = 1;
    let marker = 0x80;

    while ((first[0] & marker) === 0) {
        marker >>= 1;
        ++length;
    }

    const bytes = await reader.bytes(offset, length);

    if (bytes === undefined) {
        return undefined;
    }

    let value = keepMarker ? bytes[0] : bytes[0] & (marker - 1);
    let unknown = (bytes[0] & (marker - 1)) === marker - 1;

    for (let i = 1; i < length; ++i) {
        value = value * 256 + bytes[i];
        unknown = unknown && bytes[i] === 0xff;
    }

    return { value, length, unknown };
};

const readElement = async (reader: ByteReader, offset: number, limit: number): Promise<Element | undefined> => {
    const id = await readVarInt(reader, offset, true);

    if (id === undefined) {
        return undefined;
    }

    const size = await readVarInt(reader, offset + id.length, false);

    if (size === undefined) {
        return undefined;
    }

    const dataOffset = offset + id.length + size.length;

    // An unknown size runs to the end of the enclosing element - only Segment uses this in practice.
    const dataSize = size.unknown ? limit - dataOffset : size.value;

    if (dataSize < 0 || dataOffset + dataSize > limit) {
        return undefined;
    }

    return { id: id.value, dataOffset, dataSize, end: dataOffset + dataSize };
};

const readCodecId = async (reader: ByteReader, element: Element) => {
    const codecId = await reader.ascii(element.dataOffset, element.dataSize);
    // CodecIDs are zero-padded in some muxers' output.
    return codecId?.replace(/\0+$/, '');
};

const readTrackEntry = async (reader: ByteReader, entry: Element) => {
    let offset = entry.dataOffset;
    let trackType: number | undefined;
    let codecId: string | undefined;

    while (offset < entry.end) {
        const child = await readElement(reader, offset, entry.end);

        if (child === undefined) {
            break;
        }

        if (child.id === idTrackType) {
            trackType = await reader.unsignedInt(child.dataOffset, child.dataSize);
        } else if (child.id === idCodecId) {
            codecId = await readCodecId(reader, child);
        }

        offset = child.end;
    }

    return trackType === trackTypeAudio ? codecId : undefined;
};

const readTracks = async (reader: ByteReader, tracks: Element) => {
    const codecIds: string[] = [];
    let offset = tracks.dataOffset;

    while (offset < tracks.end) {
        const child = await readElement(reader, offset, tracks.end);

        if (child === undefined) {
            break;
        }

        if (child.id === idTrackEntry) {
            const codecId = await readTrackEntry(reader, child);

            if (codecId !== undefined) {
                codecIds.push(codecId);
            }
        }

        offset = child.end;
    }

    return codecIds;
};

/**
 * @returns CodecIDs of the audio tracks in a Matroska/WebM file, in track order.
 */
export const matroskaAudioCodecIds = async (reader: ByteReader): Promise<string[] | undefined> => {
    let offset = 0;
    let limit = reader.size;
    let elements = 0;

    while (offset < limit && ++elements <= maxElements) {
        const element = await readElement(reader, offset, limit);

        if (element === undefined) {
            return undefined;
        }

        if (element.id === idTracks) {
            return readTracks(reader, element);
        }

        if (element.id === idSegment) {
            // Descend rather than skip - Tracks lives inside Segment.
            offset = element.dataOffset;
            limit = element.end;
            continue;
        }

        offset = element.end;
    }

    return undefined;
};
