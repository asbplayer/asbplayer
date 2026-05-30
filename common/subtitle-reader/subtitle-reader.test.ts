jest.mock('@qgustavor/srt-parser', () => {
    return { default: class {} };
});
jest.mock('ass-compiler', () => {
    return { compile: () => ({ dialogues: [] }) };
});
jest.mock('fast-xml-parser', () => {
    return { XMLParser: class {} };
});
jest.mock('dompurify', () => ({
    __esModule: true,
    default: { sanitize: (html: string) => html },
    sanitize: (html: string) => html,
}));

import SubtitleReader from './subtitle-reader';
import { SubtitleHtml } from '@project/common';

function makeVttFile(content: string, name: string = 'test.vtt'): File {
    const file = new File([content], name, { type: 'text/plain' });
    // jsdom does not implement Blob.prototype.text(), so polyfill it
    if (typeof file.text !== 'function') {
        (file as any).text = () =>
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(file);
            });
    }
    return file;
}

describe('SubtitleReader VTT parsing', () => {
    let reader: SubtitleReader;

    beforeEach(() => {
        reader = new SubtitleReader({
            regexFilter: '',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: () => {
                throw new Error('PGS not supported in test');
            },
        });
    });

    it('parses a simple VTT file', async () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.000
Second subtitle
`;
        const files = [makeVttFile(vtt)];
        const subtitles = await reader.subtitles(files);

        expect(subtitles).toHaveLength(2);
        expect(subtitles[0].start).toBe(1000);
        expect(subtitles[0].end).toBe(4000);
        expect(subtitles[0].text).toBe('Hello world');
        expect(subtitles[1].start).toBe(5000);
        expect(subtitles[1].end).toBe(8000);
        expect(subtitles[1].text).toBe('Second subtitle');
    });

    it('flattens multiple VTT segments with absolute timestamps', async () => {
        const segment1 = `WEBVTT

00:00:01.000 --> 00:00:04.000
First segment

00:00:05.000 --> 00:00:08.000
Still first segment
`;
        const segment2 = `WEBVTT

00:05:01.000 --> 00:05:04.000
Second segment

00:05:05.000 --> 00:05:08.000
Still second segment
`;
        const files = [makeVttFile(segment1, 'subs.vtt'), makeVttFile(segment2, 'subs.vtt')];
        const subtitles = await reader.subtitles(files, true);

        expect(subtitles).toHaveLength(4);
        expect(subtitles[0].start).toBe(1000);
        expect(subtitles[0].text).toBe('First segment');
        expect(subtitles[2].start).toBe(301000);
        expect(subtitles[2].text).toBe('Second segment');
    });
});
