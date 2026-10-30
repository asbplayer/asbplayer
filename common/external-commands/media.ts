import type { SubtitleTrack } from '@project/common/src/model';

const cyrb53 = (str: string) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const streamingMediaId = (tabId: number, src: string) => cyrb53(`streaming:${tabId}:${src}`);

export const localMediaId = (asbplayerId: string) => cyrb53(`local:${asbplayerId}`);

export const localMediaTitle = (loadedSubtitles: SubtitleTrack[]) => {
    const [firstTrack] = loadedSubtitles;

    if (firstTrack === undefined) {
        return undefined;
    }

    const dot = firstTrack.fileName.lastIndexOf('.');
    return dot > 0 ? firstTrack.fileName.substring(0, dot) : firstTrack.fileName;
};
