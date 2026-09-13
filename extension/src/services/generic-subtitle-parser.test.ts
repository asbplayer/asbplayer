import { expect, it } from '@jest/globals';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import {
    genericSubtitleParserOptionsForHost,
    setGenericSubtitleParserOptionsForHost,
} from '@project/extension/src/services/generic-subtitle-parser';

it('returns off for an absent host', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());

    expect(await genericSubtitleParserOptionsForHost(globalState, 'example.com')).toEqual({
        parse: 'off',
    });
});

it('stores the parse type for each host', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());
    await globalState.set({
        genericSubtitleParser: {
            pages: { 'second.example': { parse: 'base' } },
        },
    });

    await setGenericSubtitleParserOptionsForHost(globalState, 'first.example', 'aggressive');
    await setGenericSubtitleParserOptionsForHost(globalState, 'first.example', 'aggressive');

    expect(await genericSubtitleParserOptionsForHost(globalState, 'first.example')).toEqual({
        parse: 'aggressive',
    });
    expect((await globalState.get(['genericSubtitleParser'])).genericSubtitleParser).toEqual({
        pages: {
            'first.example': { parse: 'aggressive' },
            'second.example': { parse: 'base' },
        },
    });
});

it('replaces the previous parse type', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());

    await setGenericSubtitleParserOptionsForHost(globalState, 'example.com', 'aggressive');
    await setGenericSubtitleParserOptionsForHost(globalState, 'example.com', 'off');

    expect(await genericSubtitleParserOptionsForHost(globalState, 'example.com')).toEqual({
        parse: 'off',
    });
    expect((await globalState.get(['genericSubtitleParser'])).genericSubtitleParser.pages['example.com']).toEqual({
        parse: 'off',
    });
});
