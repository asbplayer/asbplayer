import { Fetcher } from '../src/fetcher';
import { defaultSettings, validateSettings } from '../settings';
import { Anki, ExportParams, inheritHtmlMarkup } from './anki';

const exportParams = (mode: ExportParams['mode'], noteId?: number): ExportParams => ({
    text: 'updated sentence',
    track1: undefined,
    track2: undefined,
    track3: undefined,
    definition: undefined,
    audioClip: undefined,
    image: undefined,
    word: undefined,
    source: undefined,
    url: undefined,
    customFieldValues: {},
    tags: [],
    mode,
    noteId,
});

const ankiFetcher = (onAction?: (body: any) => any): Fetcher => ({
    fetch: jest.fn(async (_url: string, body: any) => {
        const customResponse = onAction?.(body);

        if (customResponse !== undefined) {
            return customResponse;
        }

        switch (body.action) {
            case 'findNotes':
                return { result: [42], error: null };
            case 'notesInfo':
                return { result: [{ noteId: body.params.notes[0], fields: {} }], error: null };
            case 'guiBrowse':
                return { result: [], error: null };
            default:
                return { result: null, error: null };
        }
    }),
});

const requestedActions = (fetcher: Fetcher) =>
    (fetcher.fetch as jest.Mock).mock.calls.map(([, body]) => ({ action: body.action, params: body.params }));

it('inherits marked up html', () => {
    expect(inheritHtmlMarkup('a foo bar', '<c>foo</c> <b>bar</b> is')).toEqual('a <c>foo</c> <b>bar</b>');
});

it('inherits marked up html for nested tags', () => {
    expect(inheritHtmlMarkup('a <c class="term">foo</c> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('inherits marked up html for nested tags 2', () => {
    expect(inheritHtmlMarkup('a foo bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('inherits marked up html for nested tags 3', () => {
    expect(
        inheritHtmlMarkup('a <c class="term">foo</c> bar', '<d><b><c class="term">foo</c></b></d> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});

it('inherits marked up html with break lines', () => {
    expect(inheritHtmlMarkup('a foo bar', '<d>foo</d><br> <b>bar</b> is')).toEqual('a <d>foo</d> <b>bar</b>');
});

it('does not inherit marked up html if already marked up', () => {
    expect(
        inheritHtmlMarkup('a <d><b><c class="term">foo</c></b></d> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});

describe('refreshing the Anki card browser after an update', () => {
    it('refreshes the updated note after updating the last card when enabled', async () => {
        const fetcher = ankiFetcher();
        const anki = new Anki({ ...defaultSettings, ankiRefreshBrowserAfterUpdate: true }, fetcher);

        await expect(anki.export(exportParams('updateLast'))).resolves.toBe(42);

        expect(requestedActions(fetcher)).toEqual([
            { action: 'findNotes', params: { query: 'added:1' } },
            { action: 'notesInfo', params: { notes: [42] } },
            { action: 'updateNoteFields', params: expect.any(Object) },
            { action: 'guiBrowse', params: { query: 'nid:1' } },
            { action: 'guiBrowse', params: { query: 'nid:42' } },
        ]);
    });

    it('does not refresh the card browser when the setting is disabled', async () => {
        const fetcher = ankiFetcher();
        const anki = new Anki(defaultSettings, fetcher);

        await expect(anki.export(exportParams('updateLast'))).resolves.toBe(42);

        expect(requestedActions(fetcher).map(({ action }) => action)).toEqual([
            'findNotes',
            'notesInfo',
            'updateNoteFields',
        ]);
    });

    it('refreshes the provided note after updating a specific card when enabled', async () => {
        const fetcher = ankiFetcher();
        const anki = new Anki({ ...defaultSettings, ankiRefreshBrowserAfterUpdate: true }, fetcher);

        await expect(anki.export(exportParams('updateSpecific', 84))).resolves.toBe(84);

        expect(requestedActions(fetcher)).toEqual([
            { action: 'notesInfo', params: { notes: [84] } },
            { action: 'updateNoteFields', params: expect.any(Object) },
            { action: 'guiBrowse', params: { query: 'nid:1' } },
            { action: 'guiBrowse', params: { query: 'nid:84' } },
        ]);
    });

    it('does not fail the export when refreshing the card browser fails', async () => {
        const fetcher = ankiFetcher((body) => {
            if (body.action === 'guiBrowse' && body.params.query === 'nid:42') {
                return { result: null, error: 'guiBrowse failed' };
            }

            return undefined;
        });
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        const anki = new Anki({ ...defaultSettings, ankiRefreshBrowserAfterUpdate: true }, fetcher);

        await expect(anki.export(exportParams('updateLast'))).resolves.toBe(42);
        expect(consoleError).toHaveBeenCalledWith(
            'Failed to refresh Anki card browser after updating note:',
            expect.any(Error)
        );

        consoleError.mockRestore();
    });
});

describe('Anki browser refresh setting', () => {
    it('defaults to false and survives settings validation', () => {
        expect(defaultSettings.ankiRefreshBrowserAfterUpdate).toBe(false);

        const importedSettings = validateSettings(
            JSON.parse(JSON.stringify({ ...defaultSettings, ankiRefreshBrowserAfterUpdate: true }))
        );
        expect(importedSettings.ankiRefreshBrowserAfterUpdate).toBe(true);
    });
});
