import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { gzipSync } from 'zlib';
import { TextEncoder, TextDecoder } from 'util';
import { AutoPausePreference, PlayMode } from '@project/common';
import {
    defaultSettings,
    deleteRecipe,
    effectiveSettings,
    ensureRecipeConsistency,
    moveRecipe,
    cycleRecipeId,
    normalizeRecipe,
    recipeImportUrl,
    recipeFromImportUrl,
    recipeFromSettings,
    SettingsProvider,
    updateRecipeDraft,
    isTrackSeekable,
} from '@project/common/settings';
import type { AsbplayerSettings, Recipe } from '@project/common/settings';

import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';
import { settingsForExport, validateSettings } from '@project/common/settings/import-export/settings-import-export';

const reading: Recipe = { name: 'Reading', playbackModes: [PlayMode.autoPause], settings: { playbackRate: 0.8 } };
const listening: Recipe = {
    name: 'Listening',
    playbackModes: [PlayMode.repeat],
    settings: { repeatCountPreference: 2 },
};

// jsdom lacks the browser encoding and structuredClone APIs; recipes contain only JSON data.
const originalEncoder = globalThis.TextEncoder;
const originalDecoder = globalThis.TextDecoder;
const originalClone = globalThis.structuredClone;
beforeAll(() => {
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
    globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
});
afterAll(() => {
    globalThis.TextEncoder = originalEncoder;
    globalThis.TextDecoder = originalDecoder;
    globalThis.structuredClone = originalClone;
});

describe('recipe imports and normalization', () => {
    it.each([
        { mask: 3, tracks: [0, 1] },
        { mask: 4, tracks: [2] },
        { mask: 7, tracks: [0, 1, 2] },
    ])('accepts seekable track mask $mask for tracks $tracks', ({ mask, tracks }) => {
        const recipe = normalizeRecipe({ ...reading, settings: { seekableTracks: mask } })!;
        expect([0, 1, 2].filter((track) => isTrackSeekable(recipe.settings.seekableTracks!, track))).toEqual(tracks);
    });

    it('ignores unknown and invalid settings, validates enums and finite numbers, and preserves omissions', () => {
        expect(
            normalizeRecipe({
                name: '  Reading  ',
                playbackModes: [PlayMode.normal, PlayMode.autoPause, PlayMode.autoPause, 123],
                settings: {
                    playbackRate: 0.8,
                    ankiConnectApiKey: 'secret',
                    seekableTracks: 8,
                    pauseOnHoverMode: 3,
                    autoPausePreference: 5,
                    autoPauseResumeMode: 'unexpected',
                    repeatCountPreference: 1.5,
                    autoPauseFixedDurationMs: -1,
                    subtitleTriggerStartOffset: NaN,
                    fastForwardModePlaybackRate: Infinity,
                },
            })
        ).toEqual(reading);
    });

    it.each([
        null,
        [],
        {},
        { ...reading, name: ' ' },
        { ...reading, name: 'x'.repeat(101) },
        { ...reading, playbackModes: [] },
        { ...reading, playbackModes: [99] },
        { ...reading, settings: null },
        { ...reading, settings: {} },
    ])('rejects malformed recipe %j', (input) => {
        expect(normalizeRecipe(input)).toBeUndefined();
    });

    it('accepts name and numeric boundaries and drops conflicting repeat and duration bounds', () => {
        const recipe = normalizeRecipe({
            name: 'x'.repeat(100),
            playbackModes: [PlayMode.normal],
            settings: {
                playbackRate: 16,
                subtitleTriggerStartOffset: -200,
                seekableTracks: 0,
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                repeatCountPreference: 2,
                repeatsBeforeShowingSubtitles: 3,
                autoPauseMinimumDurationMs: 1000,
                autoPauseMaximumDurationMs: 500,
            },
        });
        expect(recipe?.settings).toEqual({
            playbackRate: 16,
            subtitleTriggerStartOffset: -200,
            seekableTracks: 0,
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            repeatCountPreference: 2,
            autoPauseMinimumDurationMs: 1000,
        });
    });

    it('whitelists nested dictionary playback values and leaves annotation and credentials out', () => {
        const recipe = normalizeRecipe({
            ...reading,
            settings: {
                dictionaryTracks: [
                    {
                        dictionaryYomitanUrl: 'untrusted',
                        dictionaryWaniKaniApiToken: 'secret',
                        dictionaryPlaybackConfig: {
                            autoPause: {
                                rules: { minWords: 2, maxWords: '5', extra: true },
                                onStatuses: [{ enabled: true }, { enabled: 'yes' }],
                            },
                            wordVisibility: {
                                wholeSubtitleMatchThreshold: 2,
                                hideWordsIndividuallyUntilThreshold: false,
                            },
                            unknown: {},
                        },
                    },
                ],
            },
        });
        expect(recipe?.settings).toEqual({
            dictionaryTracks: [
                {
                    dictionaryPlaybackConfig: {
                        autoPause: { rules: { minWords: 2 }, onStatuses: [{ enabled: true }, {}] },
                        wordVisibility: { hideWordsIndividuallyUntilThreshold: false },
                    },
                },
            ],
        });
    });

    it('keeps selection attached to the original valid recipe when invalid entries are discarded', () => {
        const settings = { recipes: [null, reading, {}, listening], activeRecipeId: 3 } as unknown as AsbplayerSettings;
        ensureRecipeConsistency(settings);
        expect(settings).toEqual({ recipes: [reading, listening], activeRecipeId: 1 });
        const invalidSelection = { recipes: [reading], activeRecipeId: 0.5 };
        ensureRecipeConsistency(invalidSelection);
        expect(invalidSelection.activeRecipeId).toBeNull();
    });

    it('normalizes both reads and writes, including selection-only writes', async () => {
        const storage = new MockSettingsStorage();
        storage.setData({ recipes: [reading, listening], activeRecipeId: 8 });
        const provider = new SettingsProvider(storage);
        expect((await provider.getAll()).activeRecipeId).toBeNull();
        await provider.set({ activeRecipeId: 1 });
        expect((await provider.getAll()).activeRecipeId).toBe(1);
        expect(await provider.getSingle('activeRecipeId')).toBe(1);
        expect(await provider.get(['activeRecipeId'])).toEqual({ activeRecipeId: 1 });
        await provider.set({ recipes: [reading] });
        expect((await provider.getAll()).activeRecipeId).toBeNull();
        await provider.set({ activeRecipeId: -1 });
        expect(await provider.getSingle('activeRecipeId')).toBeNull();
    });

    it.each([
        { change: 'an edit', recipes: [{ ...reading, settings: { playbackRate: 0.9 } }] },
        { change: 'an import', recipes: [reading, listening] },
        { change: 'a deletion', recipes: [] },
    ])('preserves $change concurrent with a selection-only write', async ({ recipes }) => {
        const storage = new MockSettingsStorage();
        const selector = new SettingsProvider(storage);
        const editor = new SettingsProvider(storage);
        await editor.set({ recipes: [reading], activeRecipeId: null });

        await Promise.all([
            selector.set({ activeRecipeId: 0 }),
            editor.set({ recipes, activeRecipeId: recipes.length ? 0 : null }),
        ]);

        expect((await selector.getAll()).recipes).toEqual(recipes);
        expect(await selector.getSingle('activeRecipeId')).toBe(recipes.length ? 0 : null);
    });

    it('selects normalized recipes without rewriting malformed stored entries', async () => {
        const storage = new MockSettingsStorage();
        storage.setData({ recipes: [null, reading, {}, listening], activeRecipeId: 3 });
        const provider = new SettingsProvider(storage);
        expect(await provider.getSingle('activeRecipeId')).toBe(1);

        await provider.set({ activeRecipeId: 0 });
        expect(await provider.get(['recipes', 'activeRecipeId'])).toEqual({
            recipes: [reading, listening],
            activeRecipeId: 0,
        });
        await provider.set({ activeRecipeId: 1 });
        expect(await provider.get(['activeRecipeId'])).toEqual({ activeRecipeId: 1 });
        expect((await provider.getAll()).activeRecipeId).toBe(1);
        expect((await storage.get({ recipes: [] })).recipes).toEqual([null, reading, {}, listening]);
    });

    it.each([-1, 0.5, 1, NaN, Infinity, '0', '__proto__'])(
        'clears invalid selection-only writes for %j',
        async (activeRecipeId) => {
            const provider = new SettingsProvider(new MockSettingsStorage());
            await provider.set({ recipes: [reading], activeRecipeId: 0 });

            await provider.set({ activeRecipeId: activeRecipeId as number });

            expect(await provider.getSingle('activeRecipeId')).toBeNull();
            expect((await provider.getAll()).recipes).toEqual([reading]);
        }
    );

    it('round trips recipes through settings export and share URLs with Unicode names', () => {
        const recipe = { ...reading, name: '読む & listen #1 🎧' };
        const settings = { ...defaultSettings, recipes: [recipe], activeRecipeId: 0 };
        expect(validateSettings(settingsForExport(settings)).recipes).toEqual([recipe]);
        const url = new URL(recipeImportUrl(recipe));
        expect(url.searchParams.get('view')).toBe('settings');
        expect(url.searchParams.has('recipe')).toBe(false);
        expect(url.hash).toMatch(/^#playback\?recipe=[A-Za-z0-9_-]+$/);
        expect(recipeFromImportUrl(url)).toEqual(recipe);
        expect(recipeImportUrl(recipeFromImportUrl(url)!)).toBe(url.href);
    });

    it('keeps a full saved recipe compact while preserving all dictionary playback settings', () => {
        const recipe = { ...recipeFromSettings(defaultSettings), name: 'Default' };
        const url = new URL(recipeImportUrl(recipe));
        expect(url.href.length).toBeLessThan(JSON.stringify(recipe).length / 2);
        expect(recipeFromImportUrl(url)).toEqual(normalizeRecipe(recipe));
        expect(recipeImportUrl(recipeFromImportUrl(url)!)).toBe(url.href);
    });

    it.each(['', 'not-base64!', 'AAAA'])('rejects malformed compressed payload %j', (payload) => {
        expect(
            recipeFromImportUrl(new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`))
        ).toBeUndefined();
    });

    it('rejects oversized URL fragments even when the decoded recipe is small enough', () => {
        const json = JSON.stringify({ ...reading, ignored: 'x'.repeat(13 * 1024) });
        const payload = gzipSync(Buffer.from(json), { level: 0 }).toString('base64url');
        const url = new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`);
        expect(url.hash.length).toBeGreaterThan(16 * 1024);
        expect(recipeFromImportUrl(url)).toBeUndefined();
    });

    it.each([64 * 1024, 64 * 1024 + 1])('limits decoded recipe JSON to 64 KiB: %i bytes', (length) => {
        const empty = JSON.stringify({ ...reading, ignored: '' });
        const json = JSON.stringify({ ...reading, ignored: 'x'.repeat(length - Buffer.byteLength(empty)) });
        expect(Buffer.byteLength(json)).toBe(length);
        const payload = gzipSync(Buffer.from(json)).toString('base64url');
        const url = new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`);
        expect(recipeFromImportUrl(url)).toEqual(length === 64 * 1024 ? reading : undefined);
    });

    it('rejects expanded data over the limit even when the gzip footer claims a small recipe', () => {
        const json = JSON.stringify(reading);
        const compressed = gzipSync(Buffer.from(json + ' '.repeat(1024 * 1024)));
        compressed.writeUInt32LE(Buffer.byteLength(json), compressed.length - 4);
        const payload = compressed.toString('base64url');
        expect(payload.length).toBeLessThan(16 * 1024);
        expect(
            recipeFromImportUrl(new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`))
        ).toBeUndefined();
    });

    it.each([0, 0xffffffff])('rejects a forged gzip output size of %i', (length) => {
        const compressed = gzipSync(Buffer.from(JSON.stringify(reading)));
        compressed.writeUInt32LE(length, compressed.length - 4);
        const payload = compressed.toString('base64url');
        expect(
            recipeFromImportUrl(new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`))
        ).toBeUndefined();
    });

    it.each(['{invalid', JSON.stringify({ name: 'Malformed', settings: {} })])(
        'rejects compressed data that is not valid recipe JSON: %s',
        (json) => {
            const payload = gzipSync(Buffer.from(json)).toString('base64url');
            expect(
                recipeFromImportUrl(new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`))
            ).toBeUndefined();
        }
    );

    it('normalizes externally compressed recipe data before importing', () => {
        const payload = gzipSync(
            Buffer.from(
                JSON.stringify({
                    ...reading,
                    settings: { playbackRate: 0.8, ankiConnectApiKey: 'untrusted', repeatCountPreference: -1 },
                })
            )
        ).toString('base64url');
        expect(
            recipeFromImportUrl(new URL(`https://app.asbplayer.dev/?view=settings#playback?recipe=${payload}`))
        ).toEqual(reading);
    });
});

describe('effective recipe settings and partial drafts', () => {
    it('inherits missing settings without changing the base or recipe, including per-track dictionary fields', () => {
        const recipe: Recipe = {
            ...reading,
            settings: {
                playbackRate: 0.8,
                dictionaryTracks: [{ dictionaryPlaybackConfig: { autoPause: { rules: { minWords: 2 } } } }],
            },
        };
        const base = { ...defaultSettings, playbackRate: 1.2, recipes: [recipe], activeRecipeId: 0 };
        const effective = effectiveSettings(base);
        expect(effective.playbackRate).toBe(0.8);
        expect(effective.autoPauseResumeMode).toBe(base.autoPauseResumeMode);
        expect(effective.dictionaryTracks[0].dictionaryPlaybackConfig.autoPause.rules.minWords).toBe(2);
        expect(effective.dictionaryTracks[0].dictionaryPlaybackConfig.autoPause.rules.maxWords).toBe(0);
        expect(effective.dictionaryTracks[1]).toEqual(base.dictionaryTracks[1]);
        expect(base.playbackRate).toBe(1.2);
        expect(base.dictionaryTracks[0].dictionaryPlaybackConfig.autoPause.rules.minWords).toBe(0);
        expect(effectiveSettings({ ...base, activeRecipeId: null }).playbackRate).toBe(1.2);
    });

    it('editing one inherited dictionary leaf adds only that leaf to a partial draft', () => {
        const draft = { ...reading, settings: { playbackRate: 0.8 } };
        const rendered = effectiveSettings({ ...defaultSettings, recipes: [draft], activeRecipeId: 0 });
        const tracks = JSON.parse(JSON.stringify(rendered.dictionaryTracks));
        tracks[1].dictionaryPlaybackConfig.repeat.rules.minWords = 3;
        const edited = updateRecipeDraft(draft, rendered, { dictionaryTracks: tracks });
        expect(normalizeRecipe(edited)?.settings).toEqual({
            playbackRate: 0.8,
            dictionaryTracks: [{}, { dictionaryPlaybackConfig: { repeat: { rules: { minWords: 3 } } } }, {}],
        });
        expect(draft.settings).toEqual({ playbackRate: 0.8 });
    });
});

describe('recipe list order and selection', () => {
    it.each([null, 0, 1])('moves recipes while preserving selection %s', (activeRecipeId) => {
        expect(moveRecipe({ recipes: [reading, listening], activeRecipeId }, 0, 1)).toEqual({
            recipes: [listening, reading],
            activeRecipeId: activeRecipeId === null ? null : 1 - activeRecipeId,
        });
    });
    it('clears deleted selection and shifts later indexes', () => {
        expect(deleteRecipe({ recipes: [reading, listening], activeRecipeId: 1 }, 0)).toEqual({
            recipes: [listening],
            activeRecipeId: 0,
        });
        expect(deleteRecipe({ recipes: [reading, listening], activeRecipeId: 0 }, 0)).toEqual({
            recipes: [listening],
            activeRecipeId: null,
        });
        expect(deleteRecipe({ recipes: [reading], activeRecipeId: 0 }, 0)).toEqual({
            recipes: [],
            activeRecipeId: null,
        });
    });
    it.each([
        { forward: true, count: 0, expected: [null, null] },
        { forward: false, count: 0, expected: [null, null] },
        { forward: true, count: 1, expected: [0, null, 0] },
        { forward: false, count: 1, expected: [0, null, 0] },
        { forward: true, count: 2, expected: [0, 1, null, 0] },
        { forward: false, count: 2, expected: [1, 0, null, 1] },
    ])('cycles $count recipes with forward=$forward, including Disabled', ({ forward, count, expected }) => {
        const recipes = [reading, listening].slice(0, count);
        let activeRecipeId: number | null = null;
        const actual = expected.map(() => {
            activeRecipeId = cycleRecipeId({ recipes, activeRecipeId }, forward);
            return activeRecipeId;
        });
        expect(actual).toEqual(expected);
    });
});
