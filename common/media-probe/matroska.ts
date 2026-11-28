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

const trackTypeAudio = 2;
const trackTypeSubtitle = 17;
const trackTypeMetadata = 33;
const audioCodecPrefix = 'A';
const webVttCodecs = ['D_WEBVTT/SUBTITLES', 'D_WEBVTT/CAPTIONS', 'D_WEBVTT/DESCRIPTIONS', 'D_WEBVTT/METADATA'];

/** Match the codec ID prefixes used by the FFmpeg Matroska demuxer. */
export const isMatroskaWebVttCodec = (codecId: string) =>
    codecId === 'S_TEXT/WEBVTT' || webVttCodecs.some((codec) => codecId.startsWith(codec));

interface MatroskaSubtitleTrack {
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

const readSubtitleTrack = async (
    reader: ByteReader,
    entry: EbmlElement
): Promise<MatroskaSubtitleTrack | undefined> => {
    const fields = await children(reader, entry);
    const typeField = fields.find(({ id }) => id === idTrackType);
    const type = typeField && (await reader.unsignedInt(typeField.dataOffset, typeField.dataSize));
    if (type === undefined) throw new Error('Incomplete Matroska track metadata');
    if (type !== trackTypeSubtitle && type !== trackTypeMetadata) return;
    const codecField = fields.find(({ id }) => id === idCodecId);
    const codecId = codecField && (await reader.utf8(codecField.dataOffset, codecField.dataSize));
    if (!codecId) throw new Error('Incomplete Matroska track metadata');
    if (type === trackTypeMetadata && !isMatroskaWebVttCodec(codecId)) return; // FFmpeg treats recognized WebVTT metadata tracks as subtitle streams

    let language = 'eng'; // Matroska's default when Language is absent.
    let languageIetf: string | undefined;
    let title: string | undefined;
    for (const child of fields) {
        switch (child.id) {
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
    const tag = languageIetf || language;
    return { codecId, language: tag && tag !== 'und' ? tag : undefined, title: title || undefined };
};

const trackEntries = async (reader: ByteReader): Promise<EbmlElement[] | undefined> => {
    let offset = 0;
    let limit = reader.size;
    while (offset < limit) {
        const element = await readEbmlElement(reader, offset, limit);
        if (!element) return;
        if (element.id === idTracks) return (await children(reader, element)).filter(({ id }) => id === idTrackEntry);
        if (element.id === idSegment) {
            offset = element.dataOffset;
            limit = element.end;
        } else {
            offset = element.end;
        }
    }
};

/** Subtitle track entries in demuxer order. */
export const matroskaSubtitleTracks = async (reader: ByteReader): Promise<MatroskaSubtitleTrack[] | undefined> => {
    const entries = await trackEntries(reader);
    if (!entries) return;
    const tracks: MatroskaSubtitleTrack[] = [];
    for (const entry of entries) {
        const track = await readSubtitleTrack(reader, entry);
        if (track) tracks.push(track);
    }
    return tracks;
};

export const matroskaAudioCodecIds = async (reader: ByteReader): Promise<string[] | undefined> => {
    const entries = await trackEntries(reader);
    if (!entries) return;
    const codecs: string[] = [];
    for (const entry of entries) {
        const fields = await children(reader, entry);
        const typeField = fields.find(({ id }) => id === idTrackType);
        if (!typeField || (await reader.unsignedInt(typeField.dataOffset, typeField.dataSize)) !== trackTypeAudio) {
            continue;
        }
        const codecField = fields.find(({ id }) => id === idCodecId);
        if (!codecField) continue;
        const codecId = await reader.utf8(codecField.dataOffset, codecField.dataSize);
        if (codecId.startsWith(audioCodecPrefix)) codecs.push(codecId);
    }
    return codecs;
};
