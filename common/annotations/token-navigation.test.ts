import { describe, expect, it } from '@jest/globals';
import { TokenState, TokenStatus } from '@project/common/settings';
import { makeSubtitle, makeToken } from '@project/common/annotations/annotations-test-utils';
import { findAdjacentTokenJumpMatch, findTokenContainingSearch } from '@project/common/annotations/token-navigation';

describe('token jump navigation', () => {
    const target = { kind: 'status' as const, value: TokenStatus.UNKNOWN };

    it('returns no match for zero subtitles and filters non-seekable tracks and non-letter tokens', () => {
        expect(findAdjacentTokenJumpMatch([], target, true, 0, 1)).toBeUndefined();

        const subtitles = [
            makeSubtitle({
                index: 10,
                text: '!!!',
                tokenization: { tokens: [makeToken({ pos: [0, 3] })] },
            }),
            makeSubtitle({
                index: 11,
                track: 1,
                text: 'hidden',
                tokenization: { tokens: [makeToken({ pos: [0, 6] })] },
            }),
        ];

        expect(findAdjacentTokenJumpMatch(subtitles, target, true, 0, 1)).toBeUndefined();
    });

    it('navigates by time and wraps relative to the current selection', () => {
        const first = makeSubtitle({
            index: 10,
            start: 100,
            end: 200,
            text: 'first',
            tokenization: { tokens: [makeToken({ pos: [0, 5] })] },
        });
        const second = makeSubtitle({
            index: 20,
            start: 500,
            end: 600,
            text: 'second',
            tokenization: { tokens: [makeToken({ pos: [0, 6] })] },
        });
        const subtitles = [first, second];

        expect(findAdjacentTokenJumpMatch(subtitles, target, true, 250, 1)?.subtitle).toBe(second);
        expect(findAdjacentTokenJumpMatch(subtitles, target, false, 250, 1)?.subtitle).toBe(first);
        expect(
            findAdjacentTokenJumpMatch(subtitles, target, true, 250, 1, {
                subtitleIndex: second.index,
                tokenStart: 0,
            })?.subtitle
        ).toBe(first);
    });

    it('matches state targets', () => {
        const subtitle = makeSubtitle({
            text: 'ignored',
            tokenization: { tokens: [makeToken({ states: [TokenState.IGNORED] })] },
        });

        expect(
            findAdjacentTokenJumpMatch([subtitle], { kind: 'state', value: TokenState.IGNORED }, true, 0, 1)?.subtitle
        ).toBe(subtitle);
    });

    it('matches every token for an any-token target regardless of status or state', () => {
        const subtitle = makeSubtitle({
            text: 'first second',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 5], status: TokenStatus.MATURE, states: [TokenState.IGNORED] }),
                    makeToken({ pos: [6, 12], status: TokenStatus.UNCOLLECTED, states: [] }),
                ],
            },
        });
        const target = { kind: 'any' as const };
        const first = findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1);
        const second = findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1, first);

        expect(first?.token.pos).toEqual([0, 5]);
        expect(second?.token.pos).toEqual([6, 12]);
    });

    it('continues from a selected token after it stops matching the jump target', () => {
        const subtitle = makeSubtitle({
            index: 12,
            text: 'aaa bbb ccc',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 3], status: TokenStatus.UNKNOWN }),
                    makeToken({ pos: [4, 7], status: TokenStatus.LEARNING }),
                    makeToken({ pos: [8, 11], status: TokenStatus.UNKNOWN }),
                ],
            },
        });
        const selection = { subtitleIndex: 12, tokenStart: 4 };

        expect(findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1, selection)?.token.pos).toEqual([8, 11]);
        expect(findAdjacentTokenJumpMatch([subtitle], target, false, 0, 1, selection)?.token.pos).toEqual([0, 3]);
    });
});

describe('token search highlighting', () => {
    const subtitle = makeSubtitle({
        index: 7,
        text: 'first 語学 last',
        tokenization: {
            tokens: [
                makeToken({ pos: [0, 5] }),
                makeToken({ pos: [6, 8], readings: [{ pos: [0, 2], reading: 'ごがく' }] }),
                makeToken({ pos: [9, 13] }),
            ],
        },
    });

    it('returns the token containing a normalized plain-text search', () => {
        expect(findTokenContainingSearch(subtitle, ['IRS'])).toEqual({ subtitleIndex: 7, tokenStart: 0 });
    });

    it('returns the token containing a reading or regular-expression search', () => {
        expect(findTokenContainingSearch(subtitle, ['がく'])).toEqual({ subtitleIndex: 7, tokenStart: 6 });
        expect(findTokenContainingSearch(subtitle, [], /last/i)).toEqual({ subtitleIndex: 7, tokenStart: 9 });
    });

    it('does not highlight when a search spans tokens or tokenization is unavailable', () => {
        expect(findTokenContainingSearch(subtitle, ['first 語学'])).toBeUndefined();
        expect(findTokenContainingSearch(makeSubtitle({ tokenization: undefined }), ['word'])).toBeUndefined();
        expect(findTokenContainingSearch(undefined, ['word'])).toBeUndefined();
    });
});
