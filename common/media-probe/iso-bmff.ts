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

const maxBoxes = 4096; // Guards against walking forever through a file that isn't shaped the way we expect.

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
    let boxes = 0;
    while (offset < limit && ++boxes <= maxBoxes) {
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
    return entry?.type;
};

/**
 * Walks MP4/ISO BMFF boxes by their declared sizes, including extended sizes and boxes that
 * extend to their parent's end. Identifies audio tracks through mdia/hdlr and reads their
 * sample-entry formats from minf/stbl/stsd.
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
