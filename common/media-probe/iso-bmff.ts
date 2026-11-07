import type ByteReader from '@project/common/media-probe/byte-reader';

const boxSizeBytes = 4;
export const isoBmffBoxTypeOffset = boxSizeBytes;
export const isoBmffBoxTypeBytes = 4;
const boxHeaderBytes = boxSizeBytes + isoBmffBoxTypeBytes;
const extendedSizeBytes = 8;
const extendedSizeMarker = 1;
const extendsToParentEndMarker = 0;
const fullBoxVersionAndFlagsBytes = 4;
const handlerPredefinedBytes = 4;
const sampleEntryCountBytes = 4;
const soundHandler = 'soun';

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
    if (dataOffset > end || end > limit) return;

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
        if (box === undefined) return;
        const result = await visit(box);
        if (result !== undefined) return result;
        offset = box.end;
    }
    return;
};

const findBox = (reader: ByteReader, type: string, offset: number, limit: number) =>
    forEachBox(reader, offset, limit, async (box) => (box.type === type ? box : undefined));

const isAudioTrack = async (reader: ByteReader, mdia: Box) => {
    const hdlr = await findBox(reader, 'hdlr', mdia.dataOffset, mdia.end);
    if (hdlr === undefined) return false;
    return (
        (await reader.ascii(
            hdlr.dataOffset + fullBoxVersionAndFlagsBytes + handlerPredefinedBytes,
            isoBmffBoxTypeBytes
        )) === soundHandler
    ); // FullBox version/flags, then pre_defined, then the handler type.
};

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
    const formats: { [objectType: number]: string } = { 0xa5: 'ac-3', 0xa6: 'ec-3', 0xa9: 'dtsc' };
    return formats[objectType];
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

/**
 * Walks MP4/ISO BMFF boxes by their declared sizes, including extended sizes and boxes that
 * extend to their parent's end. Identifies audio tracks through mdia/hdlr and reads their
 * sample-entry formats from minf/stbl/stsd, resolving Dolby/DTS inside generic mp4a entries.
 *
 * @returns sample entry formats of the audio tracks in an ISO base media file, in track order.
 */
export const isoBmffAudioSampleFormats = async (reader: ByteReader): Promise<string[] | undefined> => {
    const moov = await findBox(reader, 'moov', 0, reader.size); // moov is commonly at the end of the file, so this walks top-level boxes by size rather than reading through them.
    if (moov === undefined) return;

    const formats: string[] = [];
    await forEachBox(reader, moov.dataOffset, moov.end, async (trak) => {
        if (trak.type !== 'trak') return;
        const mdia = await findBox(reader, 'mdia', trak.dataOffset, trak.end);
        if (mdia !== undefined && (await isAudioTrack(reader, mdia))) {
            const format = await sampleEntryFormat(reader, mdia);
            if (format !== undefined) formats.push(format);
        }
        return;
    });

    return formats;
};
