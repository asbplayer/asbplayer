import sanitize from 'sanitize-filename';
import { Rgb, SubtitleModel, Tokenization, TokenReading } from '../src/model';
import { TextSubtitleSettings } from '../settings/settings';
import { Progress } from '..';

export function arrayEquals<T>(a: T[], b: T[], equals = (lhs: T, rhs: T) => lhs === rhs): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i) {
        if (!equals(a[i], b[i])) {
            return false;
        }
    }

    return true;
}

export const localizedDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

export function humanReadableTime(timestamp: number, nearestTenth = false, fullyPadded = false): string {
    const totalSeconds = Math.floor(timestamp / 1000);
    let seconds;

    if (nearestTenth) {
        seconds = Math.round(((timestamp / 1000) % 60) * 10) / 10;
    } else {
        seconds = totalSeconds % 60;
    }

    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    if (fullyPadded) {
        let secondsStr: string;
        if (nearestTenth) {
            // For decimal seconds, pad integer part to 2 digits (e.g., 8.2 -> 08.2, 1 -> 01.0)
            const secondsParts = String(seconds).split('.');
            const integerPart = secondsParts[0];
            const decimalPart = secondsParts.length > 1 ? '.' + secondsParts[1] : '.0';
            secondsStr = integerPart.padStart(2, '0') + decimalPart;
        } else {
            secondsStr = String(seconds).padStart(2, '0');
        }
        return String(hours).padStart(2, '0') + 'h' + String(minutes).padStart(2, '0') + 'm' + secondsStr + 's';
    } else {
        if (hours > 0) {
            return hours + 'h' + String(minutes).padStart(2, '0') + 'm' + String(seconds).padStart(2, '0') + 's';
        }

        return minutes + 'm' + String(seconds).padStart(2, '0') + 's';
    }
}

export function timeDurationDisplay(
    milliseconds: number,
    totalMilliseconds: number,
    includeMilliseconds = true
): string {
    if (milliseconds < 0) {
        return timeDurationDisplay(0, totalMilliseconds, includeMilliseconds);
    }

    milliseconds = Math.round(milliseconds);
    const remainingMilliseconds = milliseconds % 1000;
    milliseconds = (milliseconds - remainingMilliseconds) / 1000;
    const seconds = milliseconds % 60;
    milliseconds = (milliseconds - seconds) / 60;
    const minutes = milliseconds % 60;

    if (totalMilliseconds >= 3600000) {
        const hours = (milliseconds - minutes) / 60;

        if (includeMilliseconds) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(remainingMilliseconds).padStart(3, '0')}`;
        }

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (includeMilliseconds) {
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(remainingMilliseconds).padStart(3, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getCurrentTimeString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
}

export function surroundingSubtitles(
    subtitles: SubtitleModel[],
    index: number,
    countRadius: number,
    timeRadius: number
): SubtitleModel[] {
    let startIndex = index;

    for (let i = index; i >= 0; --i) {
        startIndex = i;

        if (atBoundary(subtitles, startIndex, index, countRadius, timeRadius, Direction.backward)) {
            break;
        }
    }

    let endIndex = startIndex;

    for (let i = index; i <= subtitles.length - 1; ++i) {
        endIndex = i;

        if (atBoundary(subtitles, endIndex, index, countRadius, timeRadius, Direction.forward)) {
            break;
        }
    }

    return subtitles.slice(startIndex, endIndex + 1);
}

function indexNearTimestamp(subtitles: SubtitleModel[], timestamp: number, direction: Direction) {
    if (direction === Direction.forward) {
        for (let i = 0; i < subtitles.length; ++i) {
            if (subtitles[i].start >= timestamp) {
                return i;
            }
        }
    } else {
        for (let i = subtitles.length - 1; i >= 0; --i) {
            if (subtitles[i].start <= timestamp) {
                return i;
            }
        }
    }

    return undefined;
}

export function surroundingSubtitlesAroundInterval(
    subtitles: SubtitleModel[],
    startTimestamp: number,
    endTimestamp: number,
    countRadius: number,
    timeRadius: number
) {
    if (subtitles.length === 0) {
        return {};
    }

    let startBoundaryIndex = 0;
    const indexAfterStartTimestamp =
        indexNearTimestamp(subtitles, startTimestamp, Direction.forward) ?? subtitles.length - 1;

    for (let i = 0; i < subtitles.length; ++i) {
        startBoundaryIndex = i;

        if (
            withinBoundaryAroundInterval(
                subtitles,
                i,
                countRadius,
                timeRadius,
                startTimestamp,
                indexAfterStartTimestamp
            )
        ) {
            break;
        }
    }

    let endBoundaryIndex = subtitles.length - 1;
    const indexBeforeEndTimestamp = indexNearTimestamp(subtitles, endTimestamp, Direction.backward) ?? 0;

    for (let i = subtitles.length - 1; i >= 0; --i) {
        endBoundaryIndex = i;

        if (
            withinBoundaryAroundInterval(subtitles, i, countRadius, timeRadius, endTimestamp, indexBeforeEndTimestamp)
        ) {
            break;
        }
    }

    if (endBoundaryIndex <= startBoundaryIndex) {
        return {};
    }

    return {
        surroundingSubtitles: subtitles.slice(startBoundaryIndex, endBoundaryIndex + 1),
        subtitle: subtitles[indexAfterStartTimestamp],
    };
}

export function mockSurroundingSubtitles(
    middleSubtitle: SubtitleModel,
    maxTimestamp: number,
    timeRadius: number
): SubtitleModel[] {
    const subtitles = [middleSubtitle];
    const offset = middleSubtitle.start - middleSubtitle.originalStart;

    if (middleSubtitle.end < maxTimestamp) {
        const afterTimestamp = Math.min(maxTimestamp, middleSubtitle.end + timeRadius);
        subtitles.push({
            text: '',
            start: middleSubtitle.end,
            end: afterTimestamp,
            originalStart: middleSubtitle.end - offset,
            originalEnd: afterTimestamp - offset,
            track: middleSubtitle.track,
            index: middleSubtitle.index,
            richText: middleSubtitle.richText,
        });
    }

    if (middleSubtitle.start > 0) {
        const beforeTimestamp = Math.max(0, middleSubtitle.start - timeRadius);
        subtitles.unshift({
            text: '',
            start: beforeTimestamp,
            end: middleSubtitle.start,
            originalStart: beforeTimestamp - offset,
            originalEnd: middleSubtitle.start - offset,
            track: middleSubtitle.track,
            index: middleSubtitle.index,
            richText: middleSubtitle.richText,
        });
    }

    return subtitles;
}

enum Direction {
    forward,
    backward,
}

function atBoundary(
    subtitles: SubtitleModel[],
    index: number,
    initialIndex: number,
    countRadius: number,
    timeRadius: number,
    direction: Direction
): boolean {
    let next;

    if (direction == Direction.forward) {
        next = index + 1 < subtitles.length ? subtitles[index + 1] : null;
    } else {
        next = index - 1 >= 0 ? subtitles[index - 1] : null;
    }

    if (
        Math.abs(initialIndex - index) >= countRadius &&
        (next === null || Math.abs(next.start - subtitles[initialIndex].start) >= timeRadius)
    ) {
        return true;
    }

    return false;
}

function withinBoundaryAroundInterval(
    subtitles: SubtitleModel[],
    index: number,
    countRadius: number,
    timeRadius: number,
    timestamp: number,
    indexNearTimestamp: number
): boolean {
    const current = subtitles[index];

    if (Math.abs(indexNearTimestamp - index) <= countRadius || Math.abs(current.start - timestamp) <= timeRadius) {
        return true;
    }

    return false;
}

export function subtitleTimestampWithDelay(subtitle: Pick<SubtitleModel, 'start' | 'end'>, delay: number): number {
    const start = Math.min(subtitle.start, subtitle.end);
    const end = Math.max(subtitle.start, subtitle.end);

    return Math.max(start, Math.min(end, delay >= 0 ? start + delay : end + delay));
}

export function subtitleIntersectsTimeInterval(subtitle: SubtitleModel, interval: number[]) {
    const length = Math.max(0, subtitle.end - subtitle.start);

    if (length === 0) {
        return false;
    }

    const overlapStart = Math.max(subtitle.start, interval[0]);
    const overlapEnd = Math.min(subtitle.end, interval[1]);

    return overlapEnd - overlapStart >= length / 2;
}

export function joinSubtitles(subtitles: SubtitleModel[]) {
    return subtitles
        .filter((s) => s.text.trim() !== '')
        .map((s) => s.text)
        .join('\n');
}

export function extractText(subtitle: SubtitleModel, surroundingSubtitles: SubtitleModel[], track?: number) {
    if (surroundingSubtitles.length === 0) {
        return subtitle.text;
    }

    const interval = [subtitle.start, subtitle.end];
    return joinSubtitles(
        surroundingSubtitles
            .filter((s) => subtitleIntersectsTimeInterval(s, interval))
            .filter((s) => track === undefined || s.track === track)
    );
}

export function download(blob: Blob, name: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = sanitize(name);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}

export function computeStyles({
    subtitleColor,
    subtitleSize,
    subtitleThickness,
    subtitleOutlineThickness,
    subtitleOutlineColor,
    subtitleShadowThickness,
    subtitleShadowColor,
    subtitleBackgroundOpacity,
    subtitleBackgroundColor,
    subtitleFontFamily,
    subtitleCustomStyles,
}: TextSubtitleSettings) {
    const styles: { [key: string]: any } = {
        color: subtitleColor,
        fontSize: `${subtitleSize}px`,
        fontWeight: String(subtitleThickness),
    };

    if (subtitleOutlineThickness > 0) {
        const thickness = subtitleOutlineThickness;
        const color = subtitleOutlineColor;
        styles['WebkitTextStroke'] = `${color} ${thickness}px`;
        styles['paintOrder'] = `stroke fill`;
    }

    if (subtitleShadowThickness > 0) {
        styles['textShadow'] =
            `0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}, 0 0 ${subtitleShadowThickness}px ${subtitleShadowColor}`;
    }

    if (subtitleBackgroundOpacity > 0) {
        const opacity = subtitleBackgroundOpacity;
        const color = subtitleBackgroundColor;
        const { r, g, b } = hexToRgb(color);
        styles['backgroundColor'] = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    if (subtitleFontFamily && subtitleFontFamily.length > 0) {
        styles['fontFamily'] = `'${subtitleFontFamily}'`;
    }

    for (const customStyle of subtitleCustomStyles) {
        let key;

        if (
            customStyle.key.startsWith('webkit') ||
            customStyle.key.startsWith('moz') ||
            customStyle.key.startsWith('ms') ||
            /^o[A-Z].*/.test(customStyle.key)
        ) {
            key = customStyle.key.charAt(0).toUpperCase() + customStyle.key.slice(1);
        } else {
            key = customStyle.key;
        }

        if (!isNumeric(key)) {
            // A bug has allowed style keys that look like '0', '1',... to make it into some users' settings
            // Using such a style key with react crashes the app, so filter them out here
            styles[key] = customStyle.value;
        }
    }

    return styles;
}

export function isNumeric(str: string) {
    return !isNaN(Number(str));
}

export const HAS_LETTER_REGEX = /\p{L}/u;

export const ONLY_ASCII_LETTERS_REGEX = /^[a-z]+$/i;

const KANA_ONLY_REGEX =
    /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF61-\uFF9F\u{1B000}-\u{1B0FF}\u{1B100}-\u{1B12F}\u{1B130}-\u{1B16F}\u{1AFF0}-\u{1AFFF}]+$/u;
export function isKanaOnly(text: string) {
    return KANA_ONLY_REGEX.test(text.normalize('NFC'));
}

const KATAKANA_ONLY_REGEX =
    /^[\u30A0-\u30FF\u31F0-\u31FF\u3099\u309A\uFF61-\uFF9F\u{1B000}-\u{1B0FF}\u{1B100}-\u{1B12F}\u{1B130}-\u{1B16F}\u{1AFF0}-\u{1AFFF}]+$/u;
export function isKatakanaOnly(text: string) {
    return KATAKANA_ONLY_REGEX.test(text.normalize('NFC'));
}

export function normalizeForSearch(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/ß/g, 'ss')
        .replace(/ẞ/g, 'SS')
        .replace(/æ/g, 'ae')
        .replace(/Æ/g, 'AE')
        .replace(/œ/g, 'oe')
        .replace(/Œ/g, 'OE')
        .replace(/ø/g, 'o')
        .replace(/Ø/g, 'O')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/ł/g, 'l')
        .replace(/Ł/g, 'L')
        .normalize('NFC');
}

// https://stackoverflow.com/questions/63116039/camelcase-to-kebab-case
function kebabize(str: string) {
    const kebabized = str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase());

    if (
        kebabized.startsWith('webkit-') ||
        kebabized.startsWith('moz-') ||
        kebabized.startsWith('ms-') ||
        kebabized.startsWith('o-')
    ) {
        return `-${kebabized}`;
    }

    return kebabized;
}

export function computeStyleString(styleSettings: TextSubtitleSettings) {
    const stylesMap = computeStyles(styleSettings);
    const styleList = [];

    for (const [key, value] of Object.entries(stylesMap)) {
        styleList.push(`${kebabize(key)}: ${value} !important`);
    }

    return styleList.join(';');
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function hexToRgb(hex: string): Rgb {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) {
        return { r: 255, g: 255, b: 255 };
    }

    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

export function hex2ToPercent(hex: string): number {
    const parsed = Number.parseInt(hex.replace('#', ''), 16);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(255, parsed)) / 255;
}

export function percentToHex2(percent: number): string {
    const hex = Math.round(Math.max(0, Math.min(1, percent)) * 255)
        .toString(16)
        .toUpperCase();
    return hex.length === 1 ? `0${hex}` : hex;
}

export function sourceString(subtitleFileName: string, timestamp: number) {
    return timestamp === 0 ? subtitleFileName : `${subtitleFileName} (${humanReadableTime(timestamp, true, true)})`;
}

export function seekWithNudge(media: HTMLMediaElement, timestampSeconds: number) {
    media.currentTime = timestampSeconds;

    if (media.currentTime < timestampSeconds) {
        // Seeking is imprecise and may not land on the desired timestamp
        // Favor seeking slightly ahead to avoid getting stuck when seeking between subtitles
        media.currentTime = Math.min(media.duration, media.currentTime + 0.01);
    }

    return media.currentTime;
}

export async function inBatches<T>(
    items: T[],
    cb: (batch: T[]) => Promise<void>,
    options: { batchSize: number; statusUpdates?: (progress: Progress) => Promise<void> } = { batchSize: 5 }
): Promise<void> {
    const batchSize = options.batchSize > 0 ? options.batchSize : 1;
    let current = 0;
    const total = items.length;
    const startedAt = Date.now();
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await cb(batch);
        if (options.statusUpdates) {
            current += batch.length;
            await options.statusUpdates({ current, total, startedAt });
        }
    }
}

export async function fromBatches<T, R>(
    items: T[],
    cb: (batch: T[]) => Promise<R[]>,
    options: { batchSize: number; statusUpdates?: (progress: Progress) => Promise<void> } = { batchSize: 5 }
): Promise<R[]> {
    const batchSize = options.batchSize > 0 ? options.batchSize : 1;
    const results: R[] = [];
    let current = 0;
    const total = items.length;
    const startedAt = Date.now();
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const res = await cb(batch);
        for (let j = 0; j < res.length; j++) results.push(res[j]);
        if (options.statusUpdates) {
            current += batch.length;
            await options.statusUpdates({ current, total, startedAt });
        }
    }
    return results;
}

export async function mapAsync<T, R>(
    arr: T[],
    cb: (e: T) => Promise<R>,
    options: { batchSize: number; statusUpdates?: (progress: Progress) => Promise<void> } = { batchSize: 5 }
): Promise<R[]> {
    return fromBatches(arr, (batch) => Promise.all(batch.map(cb)), options);
}

export async function filterAsync<T>(
    arr: T[],
    cb: (e: T) => Promise<boolean>,
    options: { batchSize: number; statusUpdates?: (progress: Progress) => Promise<void> } = { batchSize: 5 }
): Promise<T[]> {
    const results = await mapAsync(arr, cb, options);
    return arr.filter((_, index) => results[index]);
}

export async function ensureStoragePersisted(): Promise<void> {
    if (!navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    const persisted = await navigator.storage.persist();
    if (!persisted) console.warn('Storage could not be persisted, data may be cleared by the browser');
}

type Block = {
    pos: number[];
};

/**
 * Iterates over a string in "blocks" where a "block" represents a collection of substrings of the passed-in string.
 * @param str The string to iterate over.
 * @param block Function respresenting the substrings to iterate over.
 * @param callback Called when iterating over each block, and also gaps between blocks. When iterating over a gap,
 * the optional block argument is undefined.
 */
export function iterateOverStringInBlocks<T, B extends Block>(
    str: string,
    block: (str: string, blockIndex: number) => B | undefined,
    callback: (left: number, right: number, block?: B) => void
) {
    let left = 0;
    let right = 0;
    let currBlock = block(str, 0);

    if (currBlock === undefined) {
        callback(0, str.length);
        return;
    }

    for (let blockIndex = 0; right < str.length; ) {
        if (currBlock !== undefined && right === currBlock.pos[0]) {
            if (right > left) {
                callback(left, right);
            }
            callback(currBlock.pos[0], currBlock.pos[1], currBlock);
            blockIndex++;
            left = currBlock.pos[1];
            currBlock = block(str, blockIndex);
        }
        right = currBlock?.pos?.[0] ?? str.length;
    }

    if (left < right) {
        callback(left, right);
    }
}

export const areTokenizationsEqual = (a: Tokenization | undefined, b: Tokenization | undefined) => {
    if (a === b) return true;
    if (!a || !b) return false;

    if (a.error !== b.error) return false;
    return arrayEquals(a.tokens, b.tokens, areTokensEqual);
};

const areTokensEqual = (aToken: any, bToken: any) => {
    if (!arrayEquals(aToken.pos, bToken.pos)) return false;
    if (aToken.status !== bToken.status) return false;
    if (!arrayEquals(aToken.states, bToken.states)) return false;
    if (!arrayEquals(aToken.readings, bToken.readings, areTokenReadingsEqual)) return false;
    if (aToken.frequency !== bToken.frequency) return false;
    if (aToken.groupingKey !== bToken.groupingKey) return false;
    return true;
};

const areTokenReadingsEqual = (a: TokenReading, b: TokenReading) =>
    arrayEquals(a.pos, b.pos) && a.reading === b.reading;

/**
 * An async safe semaphore implementation that preserves FIFO order (within a priority group).
 * Priority levels are set with acquire(), higher numbers indicate a higher priority.
 * It uses an id for release to allow multiple releases (e.g try/finally with early releases).
 * @param options.permits The number of concurrent permits.
 * @param options.lifetimeMs Maximum lifetime of an acquire before automatic release (prevents deadlocks if callers don't call this.release()).
 */
export class AsyncSemaphore {
    private permits: number;
    private lifetimeMs?: number;
    private acquired: Set<number> = new Set();
    private timers: Map<number, ReturnType<typeof setTimeout>> = new Map();
    private waiting: Map<number, ((id: number) => void)[]> = new Map();
    private counter: number = 0;
    private getNextId = () => {
        if (this.counter === Number.MAX_SAFE_INTEGER) this.counter = 0;
        return ++this.counter;
    };

    constructor(options: { permits: number; lifetimeMs?: number }) {
        this.permits = Math.floor(options.permits);
        if (this.permits <= 0) {
            throw new Error('Permits count must be positive');
        }
        this.lifetimeMs = options.lifetimeMs;
        if (this.lifetimeMs && this.lifetimeMs <= 0) {
            throw new Error('Lifetime must be positive');
        }
    }

    private _acquire(): number {
        const id = this.getNextId();
        this.acquired.add(id);
        if (this.lifetimeMs) {
            this.timers.set(
                id,
                setTimeout(() => this.release(id), this.lifetimeMs)
            );
        }
        return id;
    }

    acquire(priority: number = 0): Promise<number> {
        return new Promise<number>((resolve) => {
            if (this.permits > 0) {
                this.permits--;
                resolve(this._acquire());
            } else {
                const queue = this.waiting.get(priority);
                if (queue) queue.push(resolve);
                else this.waiting.set(priority, [resolve]);
            }
        });
    }

    release(id: number): void {
        if (!this.acquired.has(id)) return;
        this.acquired.delete(id);
        clearTimeout(this.timers.get(id)!);
        this.timers.delete(id);

        if (this.waiting.size > 0) {
            const highestPriority = Math.max(...this.waiting.keys());
            const queue = this.waiting.get(highestPriority)!;
            queue.shift()!(this._acquire());
            if (!queue.length) this.waiting.delete(highestPriority);
        } else {
            this.permits++;
        }
    }
}
