import type ByteReader from '@project/common/media-probe/byte-reader';

const boxSizeBytes = 4;
export const isoBmffBoxTypeOffset = boxSizeBytes;
export const isoBmffBoxTypeBytes = 4;
export const isoBmffTopLevelBoxTypes: readonly string[] = ['ftyp', 'styp', 'moov', 'free', 'skip', 'wide', 'mdat'];
const boxHeaderBytes = boxSizeBytes + isoBmffBoxTypeBytes;
const extendedSizeBytes = 8;
const extendedSizeMarker = 1;
const extendsToParentEndMarker = 0;
const fullBoxVersionAndFlagsBytes = 4;
const handlerPredefinedBytes = 4;
const sampleEntryCountBytes = 4;

const versionBytes = 1;
const trackIdBytes = 4;
const trackIdOffsetVersion0 = 12;
const trackIdOffsetVersion1 = 20;
const mediaLanguageOffsetVersion0 = 20;
const mediaLanguageOffsetVersion1 = 32;
const mediaLanguageBytes = 2;
const languageBitsPerCharacter = 5;
const languageCharacterMask = (1 << languageBitsPerCharacter) - 1;
const languageCharacterCodeOffset = 96; // Packed language letters use 1 for 'a'.
const languageAlphabetSize = 26;
const minimumPackedLanguage = 0x400;
const packedLanguageLimit = 0x8000;
const handlerReservedBytes = 12;
const handlerTypeEndOffset = fullBoxVersionAndFlagsBytes + handlerPredefinedBytes + isoBmffBoxTypeBytes;
const handlerNameOffset = handlerTypeEndOffset + handlerReservedBytes;
const subtitleHandlers = new Set(['text', 'sbtl', 'subt', 'subp', 'clcp']);

// AudioSampleEntry payload layout, excluding the box header.
const audioSampleEntryHeaderBytes = 28;
const soundVersionOffset = 8;
const soundVersionBytes = 2;
const soundVersionExtensionBytes = [0, 16, 36]; // ISO version 0, then QuickTime versions 1 and 2.

// MPEG-4 descriptors have a tag followed by one to four seven-bit length bytes.
const descriptorMinimumHeaderBytes = 2;
const descriptorMaxLengthBytes = 4;
const descriptorLengthRadix = 128;
const descriptorLengthValueMask = 0x7f;
const descriptorLengthContinuationFlag = 0x80;
const esDescriptorTag = 3;
const decoderConfigDescriptorTag = 4;

const esIdBytes = 2;
const esFlagsBytes = 1;
const esHeaderBytes = esIdBytes + esFlagsBytes;
const esStreamDependenceFlag = 0x80;
const esUrlFlag = 0x40;
const esOcrStreamFlag = 0x20;
const esUrlLengthBytes = 1;
// Object type (1), stream type (1), buffer size (3), and maximum/average bitrates (4 each).
const decoderConfigHeaderBytes = 13;
const objectTypeAc3 = 0xa5;
const objectTypeEac3 = 0xa6;
const objectTypeDts = 0xa9;
const audioFormatsByObjectType: Record<number, string> = {
    [objectTypeAc3]: 'ac-3',
    [objectTypeEac3]: 'ec-3',
    [objectTypeDts]: 'dtsc',
};

interface Box {
    type: string;
    dataOffset: number;
    end: number;
}

const readBox = async (reader: ByteReader, offset: number, limit: number): Promise<Box | undefined> => {
    const size = await reader.unsignedInt(offset, boxSizeBytes);
    const type = await reader.ascii(offset + isoBmffBoxTypeOffset, isoBmffBoxTypeBytes);
    if (size === undefined || type === undefined) return;

    let dataOffset = offset + boxHeaderBytes;
    let end: number;
    if (size === extendedSizeMarker) {
        const largeSize = await reader.unsignedInt(dataOffset, extendedSizeBytes);
        if (largeSize === undefined || largeSize < boxHeaderBytes + extendedSizeBytes) return;
        dataOffset += extendedSizeBytes;
        end = offset + largeSize;
    } else if (size === extendsToParentEndMarker) {
        end = limit; // A zero size means the box runs to the end of the enclosing box.
    } else if (size < boxHeaderBytes) {
        return;
    } else {
        end = offset + size;
    }
    if (!Number.isSafeInteger(end) || dataOffset > end || end > limit) return;

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
    while (offset < limit) {
        const box = await readBox(reader, offset, limit);
        if (!box) throw new Error('Invalid MP4 metadata');
        const result = await visit(box);
        if (result !== undefined) return result;
        offset = box.end;
    }
    return;
};

const findBox = (reader: ByteReader, type: string, offset: number, limit: number) =>
    forEachBox(reader, offset, limit, async (box) => (box.type === type ? box : undefined));

const readDescriptor = async (reader: ByteReader, offset: number, limit: number) => {
    if (offset + descriptorMinimumHeaderBytes > limit) return;
    const tag = (await reader.unsignedInt(offset++, 1))!;
    let size = 0;
    for (let index = 0; index < descriptorMaxLengthBytes && offset < limit; ++index) {
        const byte = (await reader.unsignedInt(offset++, 1))!;
        size = size * descriptorLengthRadix + (byte & descriptorLengthValueMask);
        if ((byte & descriptorLengthContinuationFlag) === 0) {
            const end = offset + size;
            return end <= limit ? { tag, dataOffset: offset, end } : undefined;
        }
    }
    return;
};

/** mp4a is a generic MPEG-4 audio entry; its descriptor can identify DTS or Dolby audio. */
const mp4aFormat = async (reader: ByteReader, entry: Box) => {
    if (entry.dataOffset + audioSampleEntryHeaderBytes > entry.end) return;
    const version = (await reader.unsignedInt(entry.dataOffset + soundVersionOffset, soundVersionBytes))!;
    const extensionBytes = soundVersionExtensionBytes[version];
    if (extensionBytes === undefined) return;
    const children = entry.dataOffset + audioSampleEntryHeaderBytes + extensionBytes;
    let esds = await findBox(reader, 'esds', children, entry.end);
    if (esds === undefined) {
        const wave = await findBox(reader, 'wave', children, entry.end);
        if (wave !== undefined) esds = await findBox(reader, 'esds', wave.dataOffset, wave.end);
    }
    if (esds === undefined) return;
    const es = await readDescriptor(reader, esds.dataOffset + fullBoxVersionAndFlagsBytes, esds.end);
    if (es?.tag !== esDescriptorTag || es.dataOffset + esHeaderBytes > es.end) return;
    const flags = (await reader.unsignedInt(es.dataOffset + esIdBytes, esFlagsBytes))!;
    let offset = es.dataOffset + esHeaderBytes;
    if (flags & esStreamDependenceFlag) offset += esIdBytes; // dependsOn_ES_ID
    if (flags & esUrlFlag) {
        if (offset >= es.end) return;
        offset += esUrlLengthBytes + (await reader.unsignedInt(offset, esUrlLengthBytes))!; // URLlength and URLstring
    }
    if (flags & esOcrStreamFlag) offset += esIdBytes; // OCR_ES_Id
    const decoder = await readDescriptor(reader, offset, es.end);
    if (decoder?.tag !== decoderConfigDescriptorTag || decoder.end - decoder.dataOffset < decoderConfigHeaderBytes) {
        return;
    }
    const objectType = (await reader.unsignedInt(decoder.dataOffset, 1))!;
    return audioFormatsByObjectType[objectType];
};

const sampleEntryFormat = async (reader: ByteReader, mdia: Box) => {
    const minf = await findBox(reader, 'minf', mdia.dataOffset, mdia.end);
    const stbl = minf && (await findBox(reader, 'stbl', minf.dataOffset, minf.end));
    const stsd = stbl && (await findBox(reader, 'stsd', stbl.dataOffset, stbl.end));
    if (!stsd) return;

    const entry = await readBox(
        reader,
        stsd.dataOffset + fullBoxVersionAndFlagsBytes + sampleEntryCountBytes,
        stsd.end
    ); // FullBox version/flags, then entry_count, then the first sample entry.
    if (entry === undefined) return;
    return entry.type === 'mp4a' ? ((await mp4aFormat(reader, entry)) ?? entry.type) : entry.type;
};

interface IsoBmffSubtitleTrack {
    id?: number;
    format?: string;
    language?: string;
    title?: string;
}

/**
 * Walk track headers by box size, including a moov after a large media payload.
 * @returns whether a moov box was found.
 */
const forEachTrack = async (reader: ByteReader, visit: (track: Box) => Promise<void>): Promise<boolean> => {
    const moov = await findBox(reader, 'moov', 0, reader.size);
    if (!moov) return false;
    await forEachBox(reader, moov.dataOffset, moov.end, async (track) => {
        if (track.type === 'trak') await visit(track);
    });
    return true;
};

const readTrackMedia = async (reader: ByteReader, track: Box) => {
    const mdia = await findBox(reader, 'mdia', track.dataOffset, track.end);
    const hdlr = mdia && (await findBox(reader, 'hdlr', mdia.dataOffset, mdia.end));
    if (!mdia || !hdlr || hdlr.dataOffset + handlerTypeEndOffset > hdlr.end) return;
    const handler = await reader.ascii(
        hdlr.dataOffset + fullBoxVersionAndFlagsBytes + handlerPredefinedBytes,
        isoBmffBoxTypeBytes
    );
    if (handler) return { mdia, hdlr, handler };
};

/** Decode an ISO BMFF C-string or QuickTime length-prefixed Pascal string handler name. */
const readHandlerName = async (reader: ByteReader, hdlr: Box): Promise<string | undefined> => {
    const nameOffset = hdlr.dataOffset + handlerNameOffset;
    const length = hdlr.end - nameOffset;
    if (length <= 0) return;
    const firstByte = await reader.unsignedInt(nameOffset, 1);
    const lastByte = await reader.unsignedInt(hdlr.end - 1, 1);
    if (firstByte === length - 1 && lastByte !== 0) return (await reader.utf8(nameOffset + 1, firstByte)) || undefined;
    const decoded = await reader.utf8(nameOffset, length);
    const nul = decoded.indexOf('\0');
    return (nul === -1 ? decoded : decoded.slice(0, nul)) || undefined;
};

export const isoBmffSubtitleTracks = async (reader: ByteReader): Promise<IsoBmffSubtitleTrack[] | undefined> => {
    const candidates: { id: number | undefined; mdia: Box; hdlr: Box }[] = [];
    const chapterIds = new Set<number>();
    const found = await forEachTrack(reader, async (track) => {
        const tref = await findBox(reader, 'tref', track.dataOffset, track.end);
        const chap = tref && (await findBox(reader, 'chap', tref.dataOffset, tref.end));
        if (chap) {
            if ((chap.end - chap.dataOffset) % trackIdBytes) throw new Error('Invalid MP4 chapter references');
            for (let offset = chap.dataOffset; offset < chap.end; offset += trackIdBytes) {
                const chapterId = await reader.unsignedInt(offset, trackIdBytes);
                if (chapterId === undefined) throw new Error('Truncated MP4 chapter reference');
                chapterIds.add(chapterId);
            }
        }
        const media = await readTrackMedia(reader, track);
        if (!media) throw new Error('Incomplete MP4 track metadata');
        if (!subtitleHandlers.has(media.handler)) return;
        const tkhd = await findBox(reader, 'tkhd', track.dataOffset, track.end);
        let id: number | undefined;
        if (tkhd) {
            const version = await reader.unsignedInt(tkhd.dataOffset, versionBytes);
            const idOffset = tkhd.dataOffset + (version === 1 ? trackIdOffsetVersion1 : trackIdOffsetVersion0);
            if ((version !== 0 && version !== 1) || idOffset + trackIdBytes > tkhd.end) {
                throw new Error('Invalid MP4 track header');
            }
            id = await reader.unsignedInt(idOffset, trackIdBytes);
        }
        candidates.push({ id, mdia: media.mdia, hdlr: media.hdlr });
    });
    if (!found) return;

    const tracks: IsoBmffSubtitleTrack[] = [];
    for (const { id, mdia, hdlr } of candidates) {
        if (id !== undefined && chapterIds.has(id)) continue; // Another track can identify a text track as chapters even if it comes later in the file
        const mdhd = await findBox(reader, 'mdhd', mdia.dataOffset, mdia.end);
        let language: string | undefined;
        if (mdhd) {
            const version = await reader.unsignedInt(mdhd.dataOffset, versionBytes);
            if (version !== 0 && version !== 1) throw new Error('Unsupported MP4 media header');
            const languageOffset =
                mdhd.dataOffset + (version === 1 ? mediaLanguageOffsetVersion1 : mediaLanguageOffsetVersion0);
            if (languageOffset + mediaLanguageBytes > mdhd.end) throw new Error('Truncated MP4 language');
            const packed = await reader.unsignedInt(languageOffset, mediaLanguageBytes);
            if (packed && packed >= minimumPackedLanguage && packed < packedLanguageLimit) {
                const characters = [
                    (packed >> (languageBitsPerCharacter * 2)) & languageCharacterMask,
                    (packed >> languageBitsPerCharacter) & languageCharacterMask,
                    packed & languageCharacterMask,
                ];
                if (characters.every((code) => code >= 1 && code <= languageAlphabetSize)) {
                    const decoded = String.fromCharCode(
                        ...characters.map((code) => code + languageCharacterCodeOffset)
                    );
                    if (decoded !== 'und') language = decoded;
                }
            }
        }
        const title = await readHandlerName(reader, hdlr);
        tracks.push({ id, format: await sampleEntryFormat(reader, mdia), language, title });
    }
    return tracks;
};

export const isoBmffAudioSampleFormats = async (reader: ByteReader): Promise<string[] | undefined> => {
    const formats: string[] = [];
    const found = await forEachTrack(reader, async (track) => {
        const media = await readTrackMedia(reader, track);
        if (media?.handler !== 'soun') return;
        const format = await sampleEntryFormat(reader, media.mdia);
        if (format) formats.push(format);
    });
    if (found) return formats;
};
