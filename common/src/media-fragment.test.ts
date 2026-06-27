import {
    default as MediaFragment,
    isWebmMediaFragmentSupported,
    minWebmMediaFragmentDurationMs,
    preferredWebmMediaFragmentMimeType,
    resolveWebmMediaFragmentRange,
} from './media-fragment';
import { CardModel } from './model';

const originalMediaRecorder = (globalThis as any).MediaRecorder;
const originalCaptureStream = (HTMLCanvasElement.prototype as any).captureStream;

afterEach(() => {
    (globalThis as any).MediaRecorder = originalMediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = originalCaptureStream;
});

const makeCard = (overrides: Partial<CardModel>): CardModel => ({
    subtitle: {
        text: 'text',
        start: 1_000,
        end: 2_000,
        originalStart: 1_000,
        originalEnd: 2_000,
        track: 0,
    },
    surroundingSubtitles: [],
    subtitleFileName: 'sample.ass',
    mediaTimestamp: 1_000,
    ...overrides,
});

it('resolves WebM range with minimum duration when trims collapse the interval', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, 800, 500);

    expect(startTimestamp).toEqual(1_500 - minWebmMediaFragmentDurationMs / 2);
    expect(endTimestamp).toEqual(1_500 + minWebmMediaFragmentDurationMs / 2);
});

it('resolves WebM range with negative trims by expanding capture range', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, -200, -300);

    expect(startTimestamp).toEqual(800);
    expect(endTimestamp).toEqual(2_300);
});

it('resolves WebM range with non-finite trims by treating them as zero', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(1_000, 2_000, Number.NaN, Number.NaN);

    expect(startTimestamp).toEqual(1_000);
    expect(endTimestamp).toEqual(2_000);
});

it('caps WebM range around the center of the trimmed duration', () => {
    const { startTimestamp, endTimestamp } = resolveWebmMediaFragmentRange(30_000, 50_000, 2_000, 4_000, 10_000);

    expect(startTimestamp).toEqual(34_000);
    expect(endTimestamp).toEqual(44_000);
});

it('returns false for WebM support when MediaRecorder is unavailable', () => {
    (globalThis as any).MediaRecorder = undefined;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    expect(isWebmMediaFragmentSupported()).toEqual(false);
});

it('prefers AV1 over VP9 and VP8 when available', () => {
    const supported = new Set(['video/webm;codecs=av1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8']);
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => supported.has(mimeType);

    (globalThis as any).MediaRecorder = mediaRecorder;

    expect(preferredWebmMediaFragmentMimeType()).toEqual('video/webm;codecs=av1');
});

it('falls back to generic WebM when codec probing is unavailable', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = undefined;

    (globalThis as any).MediaRecorder = mediaRecorder;

    expect(preferredWebmMediaFragmentMimeType()).toEqual('video/webm');
});

it('returns true for WebM support when MediaRecorder and captureStream are available', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => mimeType === 'video/webm';

    (globalThis as any).MediaRecorder = mediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    expect(isWebmMediaFragmentSupported()).toEqual(true);
});

it('still upgrades legacy screenshots to WebM when a source file is available', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => mimeType === 'video/webm';

    (globalThis as any).MediaRecorder = mediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    const mediaFragment = MediaFragment.fromCard(
        makeCard({
            file: {
                name: 'sample.mp4',
                blobUrl: 'blob:sample',
            },
            image: {
                base64: 'dGVzdA==',
                extension: 'jpeg',
            },
        }),
        0,
        0,
        'webm'
    );

    expect(mediaFragment?.extension).toEqual('webm');
    expect(mediaFragment?.canChangeTimestamp).toEqual(true);
});

it('exposes the resolved WebM end timestamp on the media fragment', () => {
    const mediaRecorder: any = function () {};
    mediaRecorder.isTypeSupported = (mimeType: string) => mimeType === 'video/webm';

    (globalThis as any).MediaRecorder = mediaRecorder;
    (HTMLCanvasElement.prototype as any).captureStream = () => undefined;

    const mediaFragment = MediaFragment.fromCard(
        makeCard({
            file: {
                name: 'sample.mp4',
                blobUrl: 'blob:sample',
            },
        }),
        0,
        0,
        'webm',
        200,
        300,
        10_000
    );

    expect(mediaFragment?.timestamp).toEqual(1_200);
    expect(mediaFragment?.endTimestamp).toEqual(1_700);
});
