import { SubtitleCollection } from './subtitle-collection';
import { SubtitleModel } from '../src/model';

const cue = (text: string, start: number, end: number, index: number): SubtitleModel => ({
    text,
    start,
    end,
    originalStart: start,
    originalEnd: end,
    track: 0,
    index,
});

test('subtitlesAt returns cues in source order when they share the same start time', () => {
    // Regression test for https://github.com/asbplayer/asbplayer/issues/1064:
    // IntervalTree#search orders results by (start, end), not insertion
    // order, so when the first cue in the file happens to have a later end
    // time than the second, they come back reversed unless we re-sort by
    // source index.
    const collection = new SubtitleCollection<SubtitleModel>({});
    collection.setSubtitles([cue('And I caught', 1000, 2000, 0), cue('a bunch of rocks.', 1000, 1800, 1)]);

    const { showing } = collection.subtitlesAt(1500);

    expect(showing.map((s) => s.text)).toEqual(['And I caught', 'a bunch of rocks.']);
});

test('subtitlesAt orders overlapping cues by start time', () => {
    const collection = new SubtitleCollection<SubtitleModel>({});
    collection.setSubtitles([cue('second', 1200, 2000, 0), cue('first', 1000, 1800, 1)]);

    const { showing } = collection.subtitlesAt(1500);

    expect(showing.map((s) => s.text)).toEqual(['first', 'second']);
});
