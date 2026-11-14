import { readEbmlElement } from '@project/common/media-probe/ebml';
import type { EbmlElement } from '@project/common/media-probe/ebml';
import type ByteReader from '@project/common/media-probe/byte-reader';

const idSegment = 0x18538067;
const idTracks = 0x1654ae6b;
const idTrackEntry = 0xae;
const idTrackType = 0x83;
const idCodecId = 0x86;
const idLanguage = 0x22b59c;
const idLanguageIetf = 0x22b59d;
const idName = 0x536e;

const trackTypeVideo = 1;
const trackTypeAudio = 2;
export const matroskaSubtitleTrackType = 17;
const trackTypeMetadata = 33;
const webVttCodecs = new Set(['D_WEBVTT/SUBTITLES', 'D_WEBVTT/CAPTIONS', 'D_WEBVTT/DESCRIPTIONS', 'D_WEBVTT/METADATA']);
const codecPrefixesByTrackType: Record<number, string> = {
    [trackTypeVideo]: 'V',
    [trackTypeAudio]: 'A',
    [matroskaSubtitleTrackType]: 'DS',
    [trackTypeMetadata]: 'DS',
};

interface MatroskaTrack {
    type: number;
    codecId: string;
    language?: string;
    title?: string;
}

const children = async (reader: ByteReader, parent: EbmlElement) => {
    const elements: EbmlElement[] = [];
    let offset = parent.dataOffset;
    while (offset < parent.end) {
        const element = await readEbmlElement(reader, offset, parent.end);
        if (!element) throw new Error('Invalid Matroska track metadata');
        elements.push(element);
        offset = element.end;
    }
    return elements;
};

const readTrack = async (reader: ByteReader, entry: EbmlElement): Promise<MatroskaTrack> => {
    let type: number | undefined;
    let codecId: string | undefined;
    let language = 'eng'; // Matroska's default when Language is absent.
    let languageIetf: string | undefined;
    let title: string | undefined;
    for (const child of await children(reader, entry)) {
        switch (child.id) {
            case idTrackType:
                type = await reader.unsignedInt(child.dataOffset, child.dataSize);
                break;
            case idCodecId:
                codecId = await reader.utf8(child.dataOffset, child.dataSize);
                break;
            case idLanguage:
                language = await reader.utf8(child.dataOffset, child.dataSize);
                break;
            case idLanguageIetf:
                languageIetf = await reader.utf8(child.dataOffset, child.dataSize);
                break;
            case idName:
                title = await reader.utf8(child.dataOffset, child.dataSize);
                break;
        }
    }
    if (type === undefined || !codecId) throw new Error('Incomplete Matroska track metadata');
    const tag = languageIetf || language;
    return { type, codecId, language: tag === 'und' ? undefined : tag, title };
};

/** Track entries in demuxer order; attachments are separate and follow these streams. */
export const matroskaTracks = async (reader: ByteReader): Promise<MatroskaTrack[] | undefined> => {
    let offset = 0;
    let limit = reader.size;
    while (offset < limit) {
        const element = await readEbmlElement(reader, offset, limit);
        if (!element) return;
        if (element.id === idTracks) {
            const tracks: MatroskaTrack[] = [];
            for (const entry of await children(reader, element)) {
                if (entry.id !== idTrackEntry) continue;
                const track = await readTrack(reader, entry);
                // FFmpeg skips unknown track types and inconsistent CodecID prefixes.
                if (!codecPrefixesByTrackType[track.type]?.includes(track.codecId[0])) continue;
                // FFmpeg classifies recognized WebVTT codecs as subtitles, including metadata tracks.
                if (webVttCodecs.has(track.codecId)) track.type = matroskaSubtitleTrackType;
                tracks.push(track);
            }
            return tracks;
        }
        if (element.id === idSegment) {
            offset = element.dataOffset;
            limit = element.end;
        } else {
            offset = element.end;
        }
    }
};

export const matroskaAudioCodecIds = async (reader: ByteReader): Promise<string[] | undefined> =>
    (await matroskaTracks(reader))?.filter((track) => track.type === trackTypeAudio).map((track) => track.codecId);
