import { describe, expect, it } from '@jest/globals';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { type SubtitleModel } from '@project/common/src/model';

const makeSubtitle = (overrides: Partial<SubtitleModel> = {}): SubtitleModel => ({
    text: 'subtitle',
    start: 0,
    end: 1000,
    originalStart: 0,
    originalEnd: 1000,
    track: 0,
    index: 0,
    ...overrides,
});

describe('SubtitleCollection', () => {
    it('returns an empty slice for 0 subtitles', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
        collection.setSubtitles([]);

        expect(collection.subtitlesAt(0)).toEqual({
            showing: [],
            lastShown: [],
            nextToShow: undefined,
            startedShowing: undefined,
            willStopShowing: undefined,
        });
    });

    it('returns the next subtitle before a 1-item collection begins', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
        const subtitle = makeSubtitle({ start: 500, end: 1000, index: 0 });
        collection.setSubtitles([subtitle]);

        const slice = collection.subtitlesAt(100);

        expect(slice.showing).toEqual([]);
        expect(slice.nextToShow).toEqual([subtitle]);
        expect(slice.lastShown).toEqual([]);
    });

    it('reports start and end proximity for a single showing subtitle', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ showingCheckRadiusMs: 150 });
        const subtitle = makeSubtitle({ start: 100, end: 1000, index: 0 });
        collection.setSubtitles([subtitle]);

        const nearStart = collection.subtitlesAt(200);
        const nearEnd = collection.subtitlesAt(900);

        expect(nearStart.showing).toEqual([subtitle]);
        expect(nearStart.startedShowing).toEqual(subtitle);
        expect(nearStart.willStopShowing).toBeUndefined();
        expect(nearEnd.showing).toEqual([subtitle]);
        expect(nearEnd.startedShowing).toBeUndefined();
        expect(nearEnd.willStopShowing).toEqual(subtitle);
    });

    it('returns lastShown and nextToShow across a 2-item gap', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
        const first = makeSubtitle({ start: 0, end: 1000, index: 0 });
        const second = makeSubtitle({ start: 2500, end: 3500, index: 1 });
        collection.setSubtitles([first, second]);

        const slice = collection.subtitlesAt(1500);

        expect(slice.showing).toEqual([]);
        expect(slice.lastShown).toEqual([first]);
        expect(slice.nextToShow).toEqual([second]);
    });

    it('supports lastShown and nextToShow independently across a gap', () => {
        const first = makeSubtitle({ start: 0, end: 1000, index: 0 });
        const second = makeSubtitle({ start: 2500, end: 3500, index: 1 });
        const lastOnly = new SubtitleCollection<SubtitleModel>({ returnLastShown: true });
        const nextOnly = new SubtitleCollection<SubtitleModel>({ returnNextToShow: true });

        lastOnly.setSubtitles([first, second]);
        nextOnly.setSubtitles([first, second]);

        expect(lastOnly.subtitlesAt(1500)).toMatchObject({
            showing: [],
            lastShown: [first],
            nextToShow: undefined,
        });
        expect(nextOnly.subtitlesAt(1500)).toMatchObject({
            showing: [],
            lastShown: [first],
            nextToShow: [second],
        });
    });

    it('returns 2 showing subtitles when their ranges overlap', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ showingCheckRadiusMs: 150 });
        const first = makeSubtitle({ start: 0, end: 1000, index: 0 });
        const second = makeSubtitle({ start: 500, end: 1500, index: 1 });
        collection.setSubtitles([first, second]);

        const slice = collection.subtitlesAt(750);

        expect(slice.showing).toEqual([first, second]);
        expect(slice.startedShowing).toBeUndefined();
        expect(slice.willStopShowing).toBeUndefined();
    });

    it('treats start and end minus 1 as inclusive and end as outside', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
        const first = makeSubtitle({ start: 100, end: 200, index: 0 });
        const second = makeSubtitle({ start: 300, end: 400, index: 1 });
        collection.setSubtitles([first, second]);

        expect(collection.subtitlesAt(100).showing).toEqual([first]);
        expect(collection.subtitlesAt(199).showing).toEqual([first]);
        expect(collection.subtitlesAt(200)).toMatchObject({
            showing: [],
            lastShown: [first],
            nextToShow: [second],
        });
    });

    it('skips invalid ranges and replaces old subtitles on repeated setSubtitles calls', () => {
        const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
        const oldSubtitle = makeSubtitle({ start: 0, end: 100, index: 0 });
        const zeroDuration = makeSubtitle({ start: 100, end: 100, index: 1 });
        const inverted = makeSubtitle({ start: 300, end: 200, index: 2 });
        const replacement = makeSubtitle({ start: 500, end: 600, index: 3 });

        collection.setSubtitles([oldSubtitle]);
        collection.setSubtitles([zeroDuration, inverted, replacement]);

        expect(collection.subtitlesAt(50).showing).toEqual([]);
        expect(collection.subtitlesAt(100).showing).toEqual([]);
        expect(collection.subtitlesAt(250).showing).toEqual([]);
        expect(collection.subtitlesAt(500).showing).toEqual([replacement]);
    });
});
