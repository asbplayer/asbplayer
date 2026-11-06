import { readEbmlElement } from '@project/common/media-probe/ebml';
import type { EbmlElement } from '@project/common/media-probe/ebml';
import type ByteReader from '@project/common/media-probe/byte-reader';

// EBML element IDs, with their marker bits left intact as they appear on disk.
const idSegment = 0x18538067;
const idTracks = 0x1654ae6b;
const idTrackEntry = 0xae;
const idTrackType = 0x83;
const idCodecId = 0x86;

const trackTypeAudio = 2;

// Guards against walking forever through a file that isn't shaped the way we expect.
const maxElements = 4096;

const readCodecId = async (reader: ByteReader, element: EbmlElement) => {
    const codecId = await reader.ascii(element.dataOffset, element.dataSize);
    return codecId?.replace(/\0+$/, ''); // CodecIDs are zero-padded in some muxers' output.
};

const readTrackEntry = async (reader: ByteReader, entry: EbmlElement) => {
    let offset = entry.dataOffset;
    let trackType: number | undefined;
    let codecId: string | undefined;
    while (offset < entry.end) {
        const child = await readEbmlElement(reader, offset, entry.end);
        if (child === undefined) break;
        if (child.id === idTrackType) {
            trackType = await reader.unsignedInt(child.dataOffset, child.dataSize);
        } else if (child.id === idCodecId) {
            codecId = await readCodecId(reader, child);
        }
        offset = child.end;
    }
    return trackType === trackTypeAudio ? codecId : undefined;
};

const readTracks = async (reader: ByteReader, tracks: EbmlElement) => {
    const codecIds: string[] = [];
    let offset = tracks.dataOffset;
    while (offset < tracks.end) {
        const child = await readEbmlElement(reader, offset, tracks.end);
        if (child === undefined) break;
        if (child.id === idTrackEntry) {
            const codecId = await readTrackEntry(reader, child);
            if (codecId !== undefined) codecIds.push(codecId);
        }
        offset = child.end;
    }
    return codecIds;
};

/**
 * Walks Matroska/WebM Segment → Tracks → TrackEntry metadata, selecting audio entries by
 * TrackType and reading their CodecID strings.
 *
 * @returns CodecIDs of the audio tracks in a Matroska/WebM file, in track order.
 */
export const matroskaAudioCodecIds = async (reader: ByteReader): Promise<string[] | undefined> => {
    let offset = 0;
    let limit = reader.size;
    let elements = 0;
    while (offset < limit && ++elements <= maxElements) {
        const element = await readEbmlElement(reader, offset, limit);
        if (element === undefined) return;
        if (element.id === idTracks) return readTracks(reader, element);
        if (element.id === idSegment) {
            offset = element.dataOffset; // Descend rather than skip - Tracks lives inside Segment.
            limit = element.end;
            continue;
        }
        offset = element.end;
    }
};
