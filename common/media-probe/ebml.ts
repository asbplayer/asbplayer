import type ByteReader from '@project/common/media-probe/byte-reader';

export const ebmlHeaderId = 0x1a45dfa3;
export const ebmlHeaderIdBytes = 4;
const variableIntegerMarkerBit = 0x80;
const maximumElementIdBytes = 4;
const unknownSizeContinuationByte = 0xff;
const byteRadix = 256;

export interface EbmlVarInt {
    value: number;
    length: number;
    unknown: boolean;
}

export interface EbmlElement {
    id: number;
    dataOffset: number;
    dataSize: number;
    end: number;
    unknown: boolean;
}

/**
 * Reads an EBML variable length integer. Element IDs keep their marker bits; sizes drop them.
 */
export const readEbmlVarInt = async (
    reader: ByteReader,
    offset: number,
    keepMarker = false
): Promise<EbmlVarInt | undefined> => {
    const first = await reader.bytes(offset, 1);
    if (first === undefined || first[0] === 0) return;

    let length = 1;
    let marker = variableIntegerMarkerBit;
    while ((first[0] & marker) === 0) {
        marker >>= 1;
        ++length;
    }
    if (keepMarker && length > maximumElementIdBytes) return;

    const bytes = await reader.bytes(offset, length);
    if (bytes === undefined) return;

    const valueMask = marker - 1;
    let value = keepMarker ? bytes[0] : bytes[0] & valueMask;
    let unknown = (bytes[0] & valueMask) === valueMask;
    for (let i = 1; i < length; ++i) {
        value = value * byteRadix + bytes[i];
        unknown = unknown && bytes[i] === unknownSizeContinuationByte;
    }

    return { value, length, unknown };
};

/** Reads an element header within the enclosing limit without reading its payload. */
export const readEbmlElement = async (
    reader: ByteReader,
    offset: number,
    limit: number
): Promise<EbmlElement | undefined> => {
    const id = await readEbmlVarInt(reader, offset, true);
    if (id === undefined) return;
    const size = await readEbmlVarInt(reader, offset + id.length, false);
    if (size === undefined) return;

    const dataOffset = offset + id.length + size.length;
    const dataSize = size.unknown ? limit - dataOffset : size.value; // Keep unknown sizes explicit: callers may reject an unfinished streaming cluster.
    if (dataSize < 0 || !Number.isSafeInteger(dataSize) || dataOffset + dataSize > limit) return;

    return { id: id.value, dataOffset, dataSize, end: dataOffset + dataSize, unknown: size.unknown };
};

export const findEbmlElement = async (
    reader: ByteReader,
    id: number,
    start = 0,
    end = reader.size
): Promise<EbmlElement | undefined> => {
    while (start < end) {
        const element = await readEbmlElement(reader, start, end);
        if (element === undefined) return;
        if (element.id === id) return element;
        start = element.end;
    }
};
