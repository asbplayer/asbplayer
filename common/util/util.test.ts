import { subtitleTimestampWithDelay, surroundingSubtitlesAroundInterval, timeDurationDisplay } from './util';

it('correctly displays timestamps less than 100 ms', () => {
    expect(timeDurationDisplay(50, 100, true)).toEqual('00:00.050');
});

it('correctly displays timestamps less than 100 ms (2)', () => {
    expect(timeDurationDisplay(1, 100, true)).toEqual('00:00.001');
});

it('correctly displays timestamps less than 100 ms (3)', () => {
    expect(timeDurationDisplay(99, 99, true)).toEqual('00:00.099');
});

it('correctly displays timestamps', () => {
    expect(timeDurationDisplay(999, 1000, true)).toEqual('00:00.999');
});

it('correctly displays timestamps (2)', () => {
    expect(timeDurationDisplay(1250, 1250, true)).toEqual('00:01.250');
});

function subtitle(text: string, start: number, end: number) {
    return { text, start, end, originalStart: start, originalEnd: end, track: 0 };
}

it('calculates surrounding subtitles around interval in middle when radius is 0', () => {
    const surrounding = surroundingSubtitlesAroundInterval(
        [subtitle('1', 0, 1), subtitle('2', 10, 20), subtitle('3', 25, 26), subtitle('4', 26, 30)],
        9,
        27,
        0,
        0
    );
    expect(surrounding.subtitle).toEqual(subtitle('2', 10, 20));
    expect(surrounding.surroundingSubtitles).toEqual([
        subtitle('2', 10, 20),
        subtitle('3', 25, 26),
        subtitle('4', 26, 30),
    ]);
});

it('calculates surrounding subtitles around interval in middle when radius is 0 and subtitles overlap', () => {
    const surrounding = surroundingSubtitlesAroundInterval(
        [subtitle('1', 0, 1), subtitle('2', 10, 20), subtitle('3', 15, 26), subtitle('4', 26, 30)],
        9,
        25,
        0,
        0
    );
    expect(surrounding.subtitle).toEqual(subtitle('2', 10, 20));
    expect(surrounding.surroundingSubtitles).toEqual([subtitle('2', 10, 20), subtitle('3', 15, 26)]);
});

it('computes subtitle timestamp with delay and clamps to subtitle interval', () => {
    const sample = subtitle('text', 1000, 2000);

    expect(subtitleTimestampWithDelay(sample, 300)).toBe(1300);
    expect(subtitleTimestampWithDelay(sample, 1500)).toBe(2000);
    expect(subtitleTimestampWithDelay(sample, -300)).toBe(1700);
    expect(subtitleTimestampWithDelay(sample, -1500)).toBe(1000);
});
