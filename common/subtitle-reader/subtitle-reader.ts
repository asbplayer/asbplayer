import { compile as parseAss } from 'ass-compiler';
import SrtParser from '@qgustavor/srt-parser';
import { WebVTT } from 'videojs-vtt.js';
import { XMLParser } from 'fast-xml-parser';
import { SubtitleHtml, SubtitleTextImage, Token, Tokenization } from '@project/common';
import DOMPurify from 'dompurify';

const vttClassRegex = /<(\/)?c(\.[^>]*)?>/g;
const assNewLineRegex = RegExp(/\\[nN]/, 'ig');
// Character classes shared by the Netflix ruby regexes below so they cannot drift apart.
const netflixRubyKanaClass = '\\p{sc=Hira}\\p{sc=Kana}';
const netflixRubyBaseClass = `${netflixRubyKanaClass}\\p{sc=Han}々〆〤ヶ`;
// Invisible sentinel placed before a ruby base so netflixRubyRegex cannot capture back
// into preceding kanji or kana. U+2063 is an invisible separator that in practice never
// appears in subtitle text and is a valid scalar, so extension loaders accept it in
// bundled files. The optional leading match consumes it.
const netflixRubyBaseMarker = '\u2063';
const netflixRubyRegex = new RegExp(
    `${netflixRubyBaseMarker}?([${netflixRubyBaseClass}]+)\\((?=[^)]*[${netflixRubyKanaClass}])([^)]+)\\)`,
    'gu'
);
// A base is fenceable when every character is rubyable and the reading has kana before
// any closing paren, which is when netflixRubyRegex matches, so an inserted marker is
// always consumed.
const netflixRubyBaseRegex = new RegExp(`^[${netflixRubyBaseClass}]+$`, 'u');
const netflixRubyReadingRegex = new RegExp(`^[^)]*[${netflixRubyKanaClass}]`, 'u');
const helperElement = document.createElement('div');

interface SubtitleNode {
    start: number;
    end: number;
    text: string;
    textImage?: SubtitleTextImage;
    track: number;
    tokenization?: Tokenization;
}

export interface TextFilter {
    regex: RegExp;
    replacement: string;
}

const sortVttCue = (a: VTTCue, b: VTTCue) => {
    if (typeof a.line === 'number' && typeof b.line === 'number') {
        if (a.line < b.line) {
            return -1;
        }

        if (a.line > b.line) {
            return 1;
        }

        if (typeof a.position === 'number' && typeof b.position === 'number') {
            if (a.position < b.position) {
                return -1;
            }

            if (a.position > b.position) {
                return 1;
            }

            return 0;
        }
    }

    return 0;
};

const sortVttCues = (list: VTTCue[]) => {
    if (list.length <= 1) {
        return list;
    }

    return list.sort(sortVttCue);
};

export default class SubtitleReader {
    private readonly _textFilter?: TextFilter;
    private readonly _removeXml: boolean;
    private readonly _convertNetflixRuby: boolean;
    private readonly _pgsWorkerFactory: () => Promise<Worker>;
    private xmlParser?: XMLParser;

    constructor({
        regexFilter,
        regexFilterTextReplacement,
        subtitleHtml,
        convertNetflixRuby,
        pgsParserWorkerFactory: pgsWorkerFactory,
    }: {
        regexFilter: string;
        regexFilterTextReplacement: string;
        subtitleHtml: SubtitleHtml;
        convertNetflixRuby: boolean;
        pgsParserWorkerFactory: () => Promise<Worker>;
    }) {
        let regex: RegExp | undefined;

        try {
            regex = regexFilter.trim() === '' ? undefined : new RegExp(regexFilter, 'gv');
        } catch (e) {
            regex = undefined;
        }

        if (regex === undefined) {
            this._textFilter = undefined;
        } else {
            this._textFilter = { regex, replacement: regexFilterTextReplacement };
        }

        this._removeXml = subtitleHtml === SubtitleHtml.remove;
        this._convertNetflixRuby = convertNetflixRuby;

        this._pgsWorkerFactory = pgsWorkerFactory;
    }

    async subtitles(files: File[], flatten?: boolean) {
        const allNodes = (await Promise.all(files.map((f, i) => this._subtitles(f, flatten === true ? 0 : i))))
            .flatMap((nodes) => nodes)
            .filter((node) => node.textImage !== undefined || node.text !== '')
            .sort((n1, n2) => n1.start - n2.start);

        if (this._convertNetflixRuby) {
            if (flatten) {
                // Flattened output keeps inline base(reading) without tokenizing, so
                // the ruby base markers are simply dropped here.
                for (const node of allNodes) {
                    node.text = node.text.replaceAll(netflixRubyBaseMarker, '');
                }
            } else {
                for (const node of allNodes) {
                    this._convertNetflixRubyToHtml(node);
                }
            }
        }

        if (flatten) {
            return this._deduplicate(allNodes);
        }

        return allNodes;
    }

    private _deduplicate(nodes: SubtitleNode[]) {
        const deduplicated: SubtitleNode[] = [];

        for (const node of nodes) {
            if (deduplicated.length == 0 || !this._isSame(node, deduplicated[deduplicated.length - 1])) {
                deduplicated.push(node);
            }
        }

        return deduplicated;
    }

    private _isSame(a: SubtitleNode, b: SubtitleNode) {
        if (a.textImage || b.textImage) {
            return false;
        }

        return a.start === b.start && a.end === b.end && a.text === b.text;
    }

    async _subtitles(file: File, track: number): Promise<SubtitleNode[]> {
        if (file.name.endsWith('.srt') || file.name.endsWith('.subrip')) {
            const parser = new SrtParser({ numericTimestamps: true });
            const nodes = parser.fromSrt(await file.text());
            return nodes.map((node) => {
                return {
                    start: Math.floor((node.startTime as number) * 1000),
                    end: Math.floor((node.endTime as number) * 1000),
                    text: this._filterText(node.text),
                    track: track,
                };
            });
        }

        if (file.name.endsWith('.vtt') || file.name.endsWith('.nfvtt')) {
            return new Promise(async (resolve, reject) => {
                const isFromNetflix = file.name.endsWith('.nfvtt');
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const allBuffers: VTTCue[][] = [];
                let lastTimestamp: number | undefined = undefined;
                let buffer: VTTCue[] = [];

                parser.oncue = (c: VTTCue) => {
                    c.text = this._filterText(c.text.replaceAll(vttClassRegex, ''));

                    if (isFromNetflix) {
                        const lines = c.text.split('\n');
                        const newLines: string[] = [];

                        for (const line of lines) {
                            newLines.push(this._fixRTL(line));
                        }
                        c.text = newLines.join('\n');
                    }

                    const startTime = Math.floor(c.startTime * 1000);

                    if (lastTimestamp === undefined || lastTimestamp === startTime) {
                        buffer.push(c);
                    } else {
                        buffer = sortVttCues(buffer);
                        allBuffers.push(buffer);
                        buffer = [c];
                    }

                    lastTimestamp = startTime;
                };
                parser.onflush = () => {
                    buffer = sortVttCues(buffer);
                    allBuffers.push(buffer);
                    const nodes: SubtitleNode[] = [];

                    for (const buffer of allBuffers) {
                        for (const c of buffer) {
                            nodes.push({
                                start: Math.floor(c.startTime * 1000),
                                end: Math.floor(c.endTime * 1000),
                                text: c.text,
                                track: track,
                            });
                        }
                    }

                    resolve(nodes);
                };
                parser.parse(await file.text());
                parser.flush();
            });
        }

        if (file.name.endsWith('.ass')) {
            const nodes = parseAss(await file.text(), {});
            return nodes.dialogues.map((dialogue) => {
                return {
                    start: Math.round(dialogue.start * 1000),
                    end: Math.round(dialogue.end * 1000),
                    text: this._filterText(
                        dialogue.slices.flatMap((slice) => slice.fragments.map((fragment) => fragment.text)).join('')
                    ).replace(assNewLineRegex, '\n'),
                    track: track,
                };
            });
        }

        if (file.name.endsWith('.ytsrv3')) {
            const text = await file.text();
            const xml = this._xmlParser().parse(text);
            const subtitleRows = xml['timedtext']['body']['p'];
            const subtitles: SubtitleNode[] = [];

            for (let i = 0; i < subtitleRows.length; i++) {
                const row = subtitleRows[i];

                if (typeof row['@_t'] !== 'string' || typeof row['@_d'] !== 'string') {
                    continue;
                }

                const start = Number(row['@_t']);
                let duration = Number(row['@_d']);

                if (Number.isNaN(start) || Number.isNaN(duration)) {
                    continue;
                }

                let parts = [];

                if (typeof row['#text'] === 'string') {
                    parts.push(row['#text']);
                }

                const words = row['s'];

                if (words !== undefined) {
                    if (typeof words === 'object' && Array.isArray(words)) {
                        for (const word of row['s']) {
                            if (typeof word === 'string') {
                                parts.push(word);
                            } else if (typeof word['#text'] === 'string') {
                                parts.push(word['#text']);
                            }
                        }
                    } else if (typeof words['#text'] === 'string') {
                        parts.push(words['#text']);
                    }
                }

                const text = parts.join('').trim();

                if (text) {
                    let nextRow = subtitleRows[i + 1];

                    // Prevent subtitle from overlapping with next one by reading ahead to see where the next one starts.
                    // Usually text rows are separated by empty newline rows.

                    if (nextRow?.['#text'] === '\n' && typeof nextRow['@_t'] === 'string') {
                        const nextStart = Number(nextRow['@_t']);

                        if (!Number.isNaN(nextStart)) {
                            duration = Math.min(duration, nextStart - start);
                        }
                    }

                    subtitles.push({
                        start,
                        end: start + duration,
                        text: this._filterText(text),
                        track,
                    });
                }
            }

            return subtitles;
        }

        if (file.name.endsWith('.ytxml')) {
            const text = await file.text();
            const xml = this._xmlParser().parse(text);

            if (Object.keys(xml).length === 0) {
                return [];
            }

            const textNodes = xml['transcript']['text'];
            const subtitles: SubtitleNode[] = [];
            let overlappingCount = 0;
            let lastSubtitle: SubtitleNode | undefined;

            for (let index = 0, length = textNodes.length; index < length; index++) {
                const elm = textNodes[index];

                if (!('#text' in elm) || !('@_dur' in elm) || !('@_start' in elm)) {
                    continue;
                }

                const start = parseFloat(elm['@_start']);
                const subtitle = {
                    start: Math.floor(start * 1000),
                    end: Math.floor((start + parseFloat(elm['@_dur'])) * 1000),
                    text: this._filterText(this._decodeHTML(String(elm['#text']))),
                    track,
                };

                if (lastSubtitle !== undefined && lastSubtitle.end > subtitle.start) {
                    ++overlappingCount;
                }

                subtitles.push(subtitle);
                lastSubtitle = subtitle;
            }

            const probablyAutoGenerated = subtitles.length > 0 && overlappingCount / subtitles.length > 0.5;

            if (probablyAutoGenerated) {
                return subtitles.map((subtitle, index) => {
                    // Remove overlaps if possible since auto-generated YT subs almost always overlap significantly with the previous one
                    if (index < subtitles.length - 1) {
                        return {
                            ...subtitle,
                            end: Math.max(subtitle.start, Math.min(subtitles[index + 1].start - 1, subtitle.end)),
                        };
                    }

                    return subtitle;
                });
            }

            return subtitles;
        }

        if (file.name.endsWith('.sup')) {
            return await this._parsePgs(file, track);
        }

        if (file.name.endsWith('.nfimsc')) {
            return this._parseNetflixImsc(await file.text(), track);
        }

        if (file.name.endsWith('.dfxp') || file.name.endsWith('ttml2')) {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'application/xml');
            const nodes = this._xmlNodePath(doc.documentElement, ['body', 'div']);
            const subtitles: SubtitleNode[] = [];

            for (let index = 0, length = nodes.length; index < length; index++) {
                const elm = nodes[index];
                const beginAttribute = elm.getAttribute('begin');
                const endAttribute = elm.getAttribute('end');

                if (beginAttribute === null || endAttribute === null) {
                    continue;
                }

                const start = this._parseTtmlTimestamp(beginAttribute);
                const end = this._parseTtmlTimestamp(endAttribute);

                // Skip cues whose timestamps did not parse to a finite number.
                if (!Number.isFinite(start) || !Number.isFinite(end)) {
                    continue;
                }

                const text = this._decodeHTML(elm.innerHTML.replaceAll(/<br(\s[^\s]+)?(\/)?>/g, '\n'));
                subtitles.push({
                    text: this._filterText(text),
                    start,
                    end,
                    track,
                });
            }

            return subtitles;
        }

        if (file.name.endsWith('.bbjson')) {
            const body = JSON.parse(await file.text()).body;
            return body.map((s: any) => ({
                text: this._filterText(s.content),
                start: s.from * 1000,
                end: s.to * 1000,
                track,
            }));
        }

        throw new Error('Unsupported subtitle file format');
    }

    private _parsePgs(file: File, track: number): Promise<SubtitleNode[]> {
        const subtitles: SubtitleNode[] = [];
        return new Promise(async (resolve, reject) => {
            const worker = await this._pgsWorkerFactory();
            worker.onmessage = async (e) => {
                switch (e.data.command) {
                    case 'subtitle':
                        const subtitle = { ...e.data.subtitle, track };
                        const imageBlob = e.data.imageBlob;
                        subtitle.textImage.dataUrl = await this._blobToDataUrl(imageBlob);
                        subtitles.push(subtitle);
                        break;
                    case 'finished':
                        worker.terminate();
                        resolve(subtitles);
                        break;
                    case 'error':
                        worker.terminate();
                        reject(e.data.error);
                        break;
                }
            };
            worker.onerror = (e) => {
                const error = e?.error ?? new Error('PGS decoding failed: ' + e?.message);
                reject(error);
                worker.terminate();
            };
            const canvas = document.createElement('canvas');

            // transferControlToOffscreen is not in lib.dom.d.ts
            // @ts-ignore
            const offscreenCanvas = canvas.transferControlToOffscreen();

            // Node ReadableStream clashes with web ReadableStream
            const fileStream = (await file.stream()) as unknown as ReadableStream;
            worker.postMessage({ fileStream, canvas: offscreenCanvas }, [fileStream, offscreenCanvas]);
        });
    }

    private _blobToDataUrl(blob: Blob) {
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                resolve(reader.result);
            };
        });
    }
    private _parseTtmlTimestamp(timestamp: string, tickRate?: number) {
        // Tick-based time (e.g. IMSC 1.1): "<ticks>t" resolved against ttp:tickRate.
        const tickMatch = /^([0-9]+(?:\.[0-9]+)?)t$/.exec(timestamp);

        if (tickMatch) {
            const ticks = parseFloat(tickMatch[1]);
            // Without a tick rate the value is unparseable, so let the caller drop it.
            return tickRate && tickRate > 0 ? Math.floor((ticks / tickRate) * 1000) : NaN;
        }

        // Offset time with a metric unit, e.g. "1234ms", "12.5s", "90m", "1h".
        const offsetMatch = /^([0-9]+(?:\.[0-9]+)?)(h|m|s|ms)$/.exec(timestamp);

        if (offsetMatch) {
            const value = parseFloat(offsetMatch[1]);

            switch (offsetMatch[2]) {
                case 'h':
                    return Math.floor(value * 3600000);
                case 'm':
                    return Math.floor(value * 60000);
                case 's':
                    return Math.floor(value * 1000);
                case 'ms':
                    return Math.floor(value);
            }
        }

        // Clock time: [[HH:]MM:]SS[.mmm]
        const parts = timestamp.split(':');
        const milliseconds = Math.floor(parseFloat(parts[parts.length - 1]) * 1000);
        const minutes = parts.length < 2 ? 0 : Number(parts[parts.length - 2]);
        const hours = parts.length < 3 ? 0 : Number(parts[parts.length - 3]);

        return milliseconds + minutes * 60000 + hours * 3600000;
    }

    // Parses the Netflix IMSC 1.1 (TTML) shape seen in subtitle downloads: tick-based
    // timestamps resolved against ttp:tickRate, and furigana as tts:ruby styles
    // (a container span wrapping a base span and a text span).
    private _parseNetflixImsc(text: string, track: number): SubtitleNode[] {
        const parameterNamespace = 'http://www.w3.org/ns/ttml#parameter';
        const stylingNamespace = 'http://www.w3.org/ns/ttml#styling';
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const root = doc.documentElement;

        // Resolve namespaced attributes by URI, falling back to the conventional prefix.
        const tickRateAttribute =
            root.getAttributeNS(parameterNamespace, 'tickRate') ?? root.getAttribute('ttp:tickRate');
        const tickRate = Number(tickRateAttribute ?? '') || undefined;

        // Map each style id to its ruby role (container/base/text), where defined.
        const rubyRoleByStyleId: { [id: string]: string } = {};

        for (const style of Array.from(doc.getElementsByTagNameNS('*', 'style'))) {
            const id = style.getAttribute('xml:id');
            const role = style.getAttributeNS(stylingNamespace, 'ruby') ?? style.getAttribute('tts:ruby');

            if (id !== null && role !== null) {
                rubyRoleByStyleId[id] = role;
            }
        }

        // A style attribute may list several style ids, so use the first ruby one.
        const rubyRoleOf = (element: Element) => {
            const styleRef = element.getAttribute('style');

            if (styleRef === null) {
                return undefined;
            }

            for (const id of styleRef.trim().split(/\s+/)) {
                const role = rubyRoleByStyleId[id];

                if (role !== undefined) {
                    return role;
                }
            }

            return undefined;
        };

        const subtitles: SubtitleNode[] = [];

        // Collect every <p> regardless of how many <div>s the body splits them across.
        for (const paragraph of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
            const begin = paragraph.getAttribute('begin');
            const end = paragraph.getAttribute('end');
            const dur = paragraph.getAttribute('dur');

            if (begin === null || (end === null && dur === null)) {
                continue;
            }

            const start = this._parseTtmlTimestamp(begin, tickRate);
            const stop =
                end !== null
                    ? this._parseTtmlTimestamp(end, tickRate)
                    : start + this._parseTtmlTimestamp(dur!, tickRate);

            // Skip cues whose timestamps did not parse to a finite number.
            if (!Number.isFinite(start) || !Number.isFinite(stop)) {
                continue;
            }

            subtitles.push({
                start,
                end: stop,
                text: this._filterText(this._imscParagraphText(paragraph, rubyRoleOf)),
                track,
            });
        }

        return subtitles;
    }

    // Flattens an IMSC <p> to text. Furigana renders inline as base(reading)
    // so the existing _convertNetflixRubyToHtml pass tokenizes it.
    private _imscParagraphText(node: Node, rubyRoleOf: (element: Element) => string | undefined): string {
        let text = '';

        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.nodeValue ?? '';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const element = child as Element;
                const tag = this._dropTagNamespace(element.tagName).toLowerCase();

                if (tag === 'br') {
                    text += '\n';
                } else if (rubyRoleOf(element) === 'container') {
                    text += this._imscRubyText(element, rubyRoleOf);
                } else {
                    text += this._imscParagraphText(element, rubyRoleOf);
                }
            }
        }

        return text;
    }

    private _imscRubyText(container: Element, rubyRoleOf: (element: Element) => string | undefined): string {
        let base = '';
        let reading = '';

        for (const child of Array.from(container.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                base += child.nodeValue ?? '';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const element = child as Element;

                if (rubyRoleOf(element) === 'text') {
                    reading += element.textContent ?? '';
                } else {
                    base += this._imscParagraphText(element, rubyRoleOf);
                }
            }
        }

        reading = reading.trim();

        if (reading.length === 0) {
            return base;
        }

        // Fence the base from any preceding CJK so tokenization binds the reading to this
        // base alone. Only when the shared regex is sure to match, so the marker is consumed.
        if (this._convertNetflixRuby && this._rubyBaseIsFenceable(base, reading)) {
            return `${netflixRubyBaseMarker}${base}(${reading})`;
        }

        return `${base}(${reading})`;
    }

    private _rubyBaseIsFenceable(base: string, reading: string): boolean {
        return netflixRubyBaseRegex.test(base) && netflixRubyReadingRegex.test(reading);
    }

    private _xmlNodePath(parent: Element, path: string[]): Element[] {
        if (path.length === 0) {
            const children: Element[] = [];

            for (let i = 0; i < parent.children.length; ++i) {
                const node = parent.children[i];
                children.push(node);
            }

            return children;
        }

        for (let i = 0; i < parent.children.length; ++i) {
            const node = parent.children[i];
            const tag = this._dropTagNamespace(node.tagName);

            if (tag === path[0]) {
                return this._xmlNodePath(node, path.slice(1));
            }
        }

        throw new Error('Failied to parse XML path');
    }

    private _dropTagNamespace(tag: string) {
        const colonIndex = tag.lastIndexOf(':');

        if (colonIndex !== -1) {
            return tag.substring(colonIndex + 1);
        }

        return tag;
    }

    private _fixRTL(line: string): string {
        const index1 = line.indexOf('&lrm;');
        const index2 = line.indexOf('&rlm;');
        let newLine = '';

        if (index1 > -1) {
            newLine = line.substring(0, index1) + '\u202a' + line.substring(index1 + 5) + '\u202c';
            return this._fixRTL(newLine);
        } else if (index2 > -1) {
            newLine = line.substring(0, index2) + '\u202b' + line.substring(index2 + 5) + '\u202c';
            return this._fixRTL(newLine);
        }

        return line;
    }

    private _decodeHTML(text: string): string {
        helperElement.innerHTML = text;

        const rubyTextElements = [...helperElement.getElementsByTagName('rt')];
        for (const rubyTextElement of rubyTextElements) {
            rubyTextElement.remove();
        }

        return helperElement.textContent ?? helperElement.innerText;
    }

    private _convertNetflixRubyToHtml(node: SubtitleNode) {
        if (!node.text) {
            return;
        }

        const tokens: Token[] = [];
        let currentLengthChangeDueToStringReplacement = 0;
        node.text = node.text.replace(netflixRubyRegex, (_match, base, reading, offset) => {
            const adjustedOffset = offset + currentLengthChangeDueToStringReplacement;
            tokens.push({
                pos: [adjustedOffset, adjustedOffset + base.length],
                readings: [{ pos: [0, base.length], reading }],
                states: [],
            });
            currentLengthChangeDueToStringReplacement += base.length - _match.length;
            return base;
        });
        if (tokens.length > 0) {
            node.tokenization = { tokens };
        }
    }

    private _xmlParser() {
        if (this.xmlParser === undefined) {
            this.xmlParser = new XMLParser({
                ignoreAttributes: false,
                trimValues: false,
                parseTagValue: false,
                parseAttributeValue: false,
            });
        }

        return this.xmlParser;
    }

    private _filterText(text: string): string {
        text = DOMPurify.sanitize(text);
        text =
            this._textFilter === undefined
                ? text
                : text.replace(this._textFilter.regex, this._textFilter.replacement).trim();

        if (this._removeXml) {
            text = this._decodeHTML(text);
        }

        return text;
    }

    subtitlesToSrt(subtitles: SubtitleNode[]) {
        const parser = new SrtParser({ numericTimestamps: true });
        const nodes = subtitles.map((subtitleNode, i) => {
            return {
                id: String(i),
                startTime: subtitleNode.start,
                endTime: subtitleNode.end,
                text: subtitleNode.text,
            };
        });
        return parser.toSrt(nodes);
    }

    async filesToSrt(files: File[]) {
        return this.subtitlesToSrt(await this.subtitles(files));
    }
}
