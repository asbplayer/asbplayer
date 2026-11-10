import { describe, expect, it } from '@jest/globals';
import {
    displaySubtitleSnapshot,
    mergeSubtitleAnnotations,
    originalTokenizationsEqual,
    SubtitleStream,
    subtitleKey,
    subtitleSourceStatus,
} from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { Token, Tokenization } from '@project/common';
import { TokenState, TokenStatus } from '@project/common/settings';

const cue = (cueId: number, start: number, text = 'word') => ({ cueId, start, end: start + 1000, text });
const start = (stream: SubtitleStream, track = 0, loadId = 'first') =>
    stream.update({ type: 'start', track, loadId, name: `track-${track}.srt` });

describe('originalTokenizationsEqual', () => {
    const token = (): Token => ({ pos: [0, 4], readings: [{ pos: [0, 4], reading: 'wa' }], states: [] });
    const generated = { ...token(), __internal: true };

    it('treats absent, empty, and generated-only tokenizations as equivalent', () => {
        expect(originalTokenizationsEqual(undefined, undefined)).toBe(true);
        expect(originalTokenizationsEqual(undefined, { tokens: [] })).toBe(true);
        expect(originalTokenizationsEqual({ tokens: [generated] }, undefined)).toBe(true);
    });

    it('ignores generated tokens and annotation-only fields while preserving source readings', () => {
        const annotated = {
            ...token(),
            status: TokenStatus.MATURE,
            states: [TokenState.IGNORED],
            frequency: 7,
            gloss: 'word',
        };
        expect(
            originalTokenizationsEqual(
                { tokens: [generated, token(), generated] },
                { tokens: [annotated], error: true }
            )
        ).toBe(true);
    });

    it.each<[string, Tokenization]>([
        ['token position', { tokens: [{ ...token(), pos: [1, 4] }] }],
        ['reading text', { tokens: [{ ...token(), readings: [{ pos: [0, 4], reading: 'wo' }] }] }],
        ['reading position', { tokens: [{ ...token(), readings: [{ pos: [1, 4], reading: 'wa' }] }] }],
        ['missing reading', { tokens: [{ ...token(), readings: [] }] }],
        ['missing source token', { tokens: [generated] }],
        ['additional source token', { tokens: [token(), token()] }],
    ])('detects a changed %s', (_, changed) => {
        const original = { tokens: [token()] };
        expect(originalTokenizationsEqual(original, changed)).toBe(false);
        expect(originalTokenizationsEqual(changed, original)).toBe(false);
    });
});

describe('subtitleSourceStatus', () => {
    it.each<{ statuses: SubtitleSourceStatus[]; expected: SubtitleSourceStatus }>([
        { statuses: [], expected: 'complete' },
        { statuses: ['complete'], expected: 'complete' },
        { statuses: ['loading'], expected: 'loading' },
        { statuses: ['failed'], expected: 'failed' },
        { statuses: ['complete', 'complete'], expected: 'complete' },
        { statuses: ['complete', 'loading'], expected: 'loading' },
        { statuses: ['loading', 'failed'], expected: 'failed' },
        { statuses: ['failed', 'loading'], expected: 'failed' },
    ])('summarizes $statuses as $expected', ({ statuses, expected }) => {
        const sources = statuses.map((status, track) => ({ status, track, loadId: `load-${track}`, name: '' }));
        expect(subtitleSourceStatus(sources)).toBe(expected);
    });
});

describe('SubtitleStream', () => {
    it('keeps cue identities through interleaved tracks, repeated batches and corrections', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 3000)] });
        const first = stream.snapshot.subtitles[0];
        start(stream, 1, 'translation');
        stream.update({ type: 'cues', track: 1, loadId: 'translation', cues: [cue(0, 1000, 'translation')] });
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 3000), cue(1, 5000)] });
        expect(stream.snapshot.subtitles.map(({ track, index, text }) => ({ track, index, text }))).toEqual([
            { track: 1, index: 0, text: 'translation' },
            { track: 0, index: 1, text: 'word' },
            { track: 0, index: 2, text: 'word' },
        ]);
        expect(subtitleKey(stream.snapshot.subtitles[1])).toBe(subtitleKey(first));
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 2000, 'corrected')] });
        expect(stream.snapshot.subtitles[1]).toMatchObject({ index: 1, start: 2000, text: 'corrected' });
    });

    it('ignores stale and terminal updates, retaining partial cues after failure', () => {
        const stream = new SubtitleStream();
        start(stream);
        start(stream, 0, 'replacement');
        expect(stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 0)] })).toBe(false);
        stream.update({ type: 'cues', track: 0, loadId: 'replacement', cues: [cue(0, 1000)] });
        stream.update({ type: 'failed', track: 0, loadId: 'replacement', error: 'Disconnected' });
        expect(stream.snapshot.tracks[0]).toMatchObject({ status: 'failed', error: 'Disconnected' });
        expect(stream.snapshot.subtitles).toHaveLength(1);
        expect(stream.update({ type: 'complete', track: 0, loadId: 'replacement' })).toBe(false);
        expect(stream.update({ type: 'cues', track: 0, loadId: 'replacement', cues: [cue(1, 3000)] })).toBe(false);
    });

    it('replays loading, completed, failed and empty tracks without losing identity', () => {
        const stream = new SubtitleStream();
        for (let track = 0; track < 3; track++) start(stream, track, `load-${track}`);
        stream.update({ type: 'cues', track: 0, loadId: 'load-0', cues: [cue(7, 1000)] });
        stream.update({ type: 'complete', track: 1, loadId: 'load-1' });
        stream.update({ type: 'failed', track: 2, loadId: 'load-2', error: 'Interrupted' });
        const receiver = new SubtitleStream();
        receiver.update({ type: 'snapshot', ...stream.snapshot });
        expect(receiver.snapshot).toEqual(stream.snapshot);
        receiver.update({ type: 'cues', track: 0, loadId: 'load-0', cues: [cue(8, 3000)] });
        expect(receiver.snapshot.subtitles).toHaveLength(2);
        receiver.update({ type: 'snapshot', tracks: [], subtitles: [] });
        expect(receiver.snapshot).toEqual({ tracks: [], subtitles: [] });
    });

    it('rejects invalid batches and snapshots atomically', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({
            type: 'cues',
            track: 0,
            loadId: 'first',
            cues: [cue(0, 0, '<b>word</b>')],
        });
        expect(stream.snapshot.subtitles[0].text).toBe('<b>word</b>');
        const previous = stream.snapshot;
        expect(() =>
            stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(1, 2000), cue(-1, 3000)] })
        ).toThrow();
        expect(stream.snapshot).toEqual(previous);
        expect(() => stream.update({ type: 'snapshot', tracks: [], subtitles: previous.subtitles })).toThrow();
        expect(stream.snapshot).toEqual(previous);
    });

    it('sorts unordered cues within a batch without changing their identities', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(2, 3000), cue(0, 1000), cue(1, 2000)] });
        expect(
            stream.snapshot.subtitles.map(({ index, originalStart, source }) => ({ index, originalStart, source }))
        ).toEqual([
            { index: 0, originalStart: 1000, source: { loadId: 'first', cueId: 0 } },
            { index: 1, originalStart: 2000, source: { loadId: 'first', cueId: 1 } },
            { index: 2, originalStart: 3000, source: { loadId: 'first', cueId: 2 } },
        ]);
    });

    it('retains annotations and offsets while growing, but rejects stale text or load results', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 3000)] });
        const displayed = displaySubtitleSnapshot(stream.snapshot, [], 500);
        const annotated = { ...displayed[0], originalText: 'word', text: '<span>word</span>' };
        start(stream, 1, 'other');
        stream.update({ type: 'cues', track: 1, loadId: 'other', cues: [cue(0, 1000, 'other')] });
        const current = displaySubtitleSnapshot(stream.snapshot, [annotated], 500);
        expect(current[1]).toMatchObject({ index: 1, start: 3500, originalStart: 3000, text: annotated.text });
        expect(mergeSubtitleAnnotations(current, [annotated])[1]).toMatchObject({
            index: 1,
            start: 3500,
            text: annotated.text,
        });
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 3000, 'corrected')] });
        const corrected = displaySubtitleSnapshot(stream.snapshot, current, 500);
        expect(mergeSubtitleAnnotations(corrected, [annotated])[1].text).toBe('corrected');
        start(stream, 0, 'replacement');
        stream.update({ type: 'cues', track: 0, loadId: 'replacement', cues: [cue(0, 3000)] });
        expect(
            mergeSubtitleAnnotations(displaySubtitleSnapshot(stream.snapshot, corrected, 500), [annotated])[1].text
        ).toBe('word');
    });

    it('keeps source-provided readings separate from mutable annotation state', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({
            type: 'cues',
            track: 0,
            loadId: 'first',
            cues: [
                {
                    ...cue(0, 0),
                    tokenization: {
                        tokens: [{ pos: [0, 4], states: [], readings: [{ pos: [0, 4], reading: 'source' }] }],
                    },
                },
            ],
        });
        const displayed = displaySubtitleSnapshot(stream.snapshot, [], 0);
        displayed[0].tokenization!.error = true;
        displayed[0].tokenization!.tokens[0].readings[0].reading = 'generated';
        expect(stream.snapshot.subtitles[0].tokenization).toEqual({
            tokens: [{ pos: [0, 4], states: [], readings: [{ pos: [0, 4], reading: 'source' }] }],
        });
    });

    it('discards retained annotations if source-provided readings change', () => {
        const stream = new SubtitleStream();
        start(stream);
        const tokens = [
            {
                pos: [0, 4] as [number, number],
                readings: [{ pos: [0, 4] as [number, number], reading: 'first' }],
                states: [],
            },
        ];
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [{ ...cue(0, 0), tokenization: { tokens } }] });
        const annotated = {
            ...displaySubtitleSnapshot(stream.snapshot, [], 0)[0],
            text: '<span>word</span>',
            originalText: 'word',
        };
        stream.update({
            type: 'cues',
            track: 0,
            loadId: 'first',
            cues: [
                {
                    ...cue(0, 0),
                    tokenization: { tokens: [{ ...tokens[0], readings: [{ pos: [0, 4], reading: 'second' }] }] },
                },
            ],
        });
        const current = displaySubtitleSnapshot(stream.snapshot, [annotated], 0);
        expect(current[0].text).toBe('word');
        expect(mergeSubtitleAnnotations(current, [annotated])[0].tokenization?.tokens[0].readings[0].reading).toBe(
            'second'
        );
    });
});
