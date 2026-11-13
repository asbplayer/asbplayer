import { describe, expect, it } from '@jest/globals';
import {
    displaySubtitleSnapshot,
    diffCues,
    mergeSubtitleAnnotations,
    originalTokenizationsEqual,
    SubtitleStream,
    subtitleKey,
    subtitleSourceStatus,
    subtitleSourceNames,
    subtitleReference,
    resolveSubtitleReference,
    sameSubtitleSourceContent,
    sameSubtitleAppearance,
} from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { Token, Tokenization } from '@project/common';
import { TokenState, TokenStatus } from '@project/common/settings';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';

const cue = (cueId: number, start: number, text = 'word') => ({ cueId, start, end: start + 1000, text });
const start = (stream: SubtitleStream, track = 0, loadId = 'first') =>
    stream.update({ type: 'start', track, loadId, name: `track-${track}.srt` });

describe('subtitle references', () => {
    it('resolves cue zero by track and load after earlier cues change its index', () => {
        const original = makeSubtitle({ track: 1, index: 0, source: { loadId: 'selected', cueId: 0 } });
        const reference = subtitleReference(original);
        const moved = { ...original, index: 2 };
        const current = [
            makeSubtitle({ index: 0, source: { loadId: 'selected', cueId: 0 } }),
            makeSubtitle({ track: 1, index: 1, source: { loadId: 'other', cueId: 0 } }),
            moved,
        ];
        expect(resolveSubtitleReference([], reference)).toBeUndefined();
        expect(resolveSubtitleReference(current, reference)).toBe(moved);
        expect(resolveSubtitleReference(current.slice(0, 2), reference)).toBeUndefined();
    });

    it('uses indexes for legacy references that have no cue identity', () => {
        const current = [makeSubtitle({ index: 0 }), makeSubtitle({ index: 1 })];
        expect(resolveSubtitleReference(current, 1)).toBe(current[1]);
        expect(resolveSubtitleReference(current, { index: 0, track: 0 })).toBe(current[0]);
    });
});

it('keeps source file names aligned with sparse track slots regardless of input order', () => {
    expect(subtitleSourceNames([])).toEqual([]);
    expect(subtitleSourceNames([{ track: 2, name: 'third.ass' }])).toEqual(['', '', 'third.ass']);
    expect(
        subtitleSourceNames([
            { track: 2, name: 'third.ass' },
            { track: 0, name: 'first.srt' },
        ])
    ).toEqual(['first.srt', '', 'third.ass']);
});

describe('diffCues', () => {
    const identified = (cueId: number) => makeSubtitle({ source: { loadId: 'source', cueId } });

    it('handles empty collections, the first cue, and clearing the collection', () => {
        const first = identified(0);
        expect(diffCues([], [], sameSubtitleSourceContent)).toEqual({
            added: [],
            retained: [],
            changed: [],
            removedKeys: [],
        });
        expect(diffCues([], [first], sameSubtitleSourceContent)).toEqual({
            added: [first],
            retained: [],
            changed: [],
            removedKeys: [],
        });
        expect(diffCues([first], [], sameSubtitleSourceContent)).toEqual({
            added: [],
            retained: [],
            changed: [],
            removedKeys: [subtitleKey(first)],
        });
    });

    it('matches identities across reindexing and separates corrections, additions, and removals', () => {
        const retained = identified(0);
        const changed = identified(1);
        const removed = identified(2);
        const added = identified(3);
        const reindexed = { ...retained, index: 2 };
        const corrected = { ...changed, text: 'corrected' };
        expect(
            diffCues([retained, changed, removed], [added, corrected, reindexed], sameSubtitleSourceContent)
        ).toEqual({
            added: [added],
            retained: [{ previous: retained, next: reindexed }],
            changed: [{ previous: changed, next: corrected }],
            removedKeys: [subtitleKey(removed)],
        });
    });

    it('keeps cue IDs scoped to their track and load', () => {
        const first = identified(0);
        const otherTrack = { ...first, track: 1 };
        const replacement = { ...first, source: { loadId: 'replacement', cueId: 0 } };
        expect(diffCues([first, otherTrack], [otherTrack, replacement], sameSubtitleSourceContent)).toEqual({
            added: [replacement],
            retained: [{ previous: otherTrack, next: otherTrack }],
            changed: [],
            removedKeys: [subtitleKey(first)],
        });
    });

    it('lets consumers distinguish source content from rendered appearance', () => {
        const first = identified(0);
        const annotated = { ...first, originalText: first.text, text: '<b>subtitle</b>' };
        expect(diffCues([first], [annotated], sameSubtitleSourceContent).retained).toEqual([
            { previous: first, next: annotated },
        ]);
        expect(diffCues([first], [annotated], sameSubtitleAppearance).changed).toEqual([
            { previous: first, next: annotated },
        ]);
    });
});

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
        stream.update({ type: 'cues', track: 2, loadId: 'load-2', cues: [cue(7, 2000, 'partial')] });
        stream.update({ type: 'complete', track: 1, loadId: 'load-1' });
        stream.update({ type: 'failed', track: 2, loadId: 'load-2', error: 'Interrupted' });
        const receiver = new SubtitleStream();
        receiver.update({ type: 'snapshot', ...stream.sourceSnapshot });
        expect(receiver.snapshot).toEqual(stream.snapshot);
        receiver.update({ type: 'cues', track: 0, loadId: 'load-0', cues: [cue(8, 3000)] });
        expect(receiver.snapshot.subtitles).toHaveLength(3);
        receiver.update({ type: 'snapshot', tracks: [] });
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
        expect(() =>
            stream.update({
                type: 'snapshot',
                tracks: [previous.tracks[0], previous.tracks[0]].map((state) => ({ ...state, cues: [] })),
            })
        ).toThrow();
        expect(stream.snapshot).toEqual(previous);
    });

    it('transports compact source cues with original timing, images, and readings per track', () => {
        const stream = new SubtitleStream();
        const textImage = {
            dataUrl: 'data:image/png;base64,AA==',
            screen: { width: 640, height: 360 },
            image: { width: 100, height: 20 },
        };
        const tokenization = {
            tokens: [
                {
                    pos: [0, 4] as [number, number],
                    states: [],
                    readings: [{ pos: [0, 4] as [number, number], reading: 'word' }],
                },
            ],
        };
        stream.replace(
            [
                makeSubtitle({
                    start: 1500,
                    end: 2500,
                    originalStart: 1000,
                    originalEnd: 2000,
                    index: 8,
                    text: 'word',
                    source: { loadId: 'first', cueId: 7 },
                    textImage,
                    tokenization,
                }),
            ],
            ['source.ass', 'empty.srt']
        );
        const wire = JSON.parse(JSON.stringify(stream.sourceSnapshot));
        expect(wire).toEqual({
            tracks: [
                {
                    track: 0,
                    loadId: 'first',
                    name: 'source.ass',
                    status: 'complete',
                    cues: [{ cueId: 7, start: 1000, end: 2000, text: 'word', textImage, tokenization }],
                },
                { track: 1, loadId: expect.any(String), name: 'empty.srt', status: 'complete', cues: [] },
            ],
        });
        const receiver = new SubtitleStream();
        receiver.update({ type: 'snapshot', ...wire });
        expect(displaySubtitleSnapshot(receiver.snapshot, [], 1250)).toMatchObject([
            {
                index: 0,
                start: 2250,
                end: 3250,
                originalStart: 1000,
                originalEnd: 2000,
                source: { loadId: 'first', cueId: 7 },
                textImage,
                tokenization,
            },
        ]);
    });

    it('rejects a malformed snapshot without replacing an existing source', () => {
        const stream = new SubtitleStream();
        start(stream);
        stream.update({ type: 'cues', track: 0, loadId: 'first', cues: [cue(0, 1000)] });
        const previous = stream.snapshot;
        expect(() =>
            stream.update({
                type: 'snapshot',
                tracks: [
                    { track: 0, loadId: 'replacement', name: 'valid', status: 'complete', cues: [cue(1, 2000)] },
                    { track: 1, loadId: 'other', name: 'invalid', status: 'loading', cues: [cue(-1, 3000)] },
                ],
            })
        ).toThrow('Invalid subtitle cue');
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
