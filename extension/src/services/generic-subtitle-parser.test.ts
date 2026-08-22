import { expect, it } from '@jest/globals';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import {
    genericSubtitleParserOptionsForHost,
    setGenericSubtitleParserOptionsForHost,
} from '@project/extension/src/services/generic-subtitle-parser';

it('returns both options disabled for an absent host', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());

    expect(await genericSubtitleParserOptionsForHost(globalState, 'example.com')).toEqual({
        enabled: false,
        aggressiveEnabled: false,
    });
});

it('stores both options atomically for each host', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());
    await globalState.set({
        genericSubtitleParser: {
            pages: { 'second.example': { enabled: true, aggressiveEnabled: false } },
        },
    });

    await setGenericSubtitleParserOptionsForHost(globalState, 'first.example', true, true);
    await setGenericSubtitleParserOptionsForHost(globalState, 'first.example', true, true);

    expect(await genericSubtitleParserOptionsForHost(globalState, 'first.example')).toEqual({
        enabled: true,
        aggressiveEnabled: true,
    });
    expect((await globalState.get(['genericSubtitleParser'])).genericSubtitleParser).toEqual({
        pages: {
            'first.example': { enabled: true, aggressiveEnabled: true },
            'second.example': { enabled: true, aggressiveEnabled: false },
        },
    });
});

it('keeps aggressive mode independent when regular detection is disabled', async () => {
    const globalState = new ExtensionGlobalStateProvider(new MockStorageArea());

    await setGenericSubtitleParserOptionsForHost(globalState, 'example.com', true, true);
    await setGenericSubtitleParserOptionsForHost(globalState, 'example.com', false, true);

    expect(await genericSubtitleParserOptionsForHost(globalState, 'example.com')).toEqual({
        enabled: false,
        aggressiveEnabled: true,
    });
    expect((await globalState.get(['genericSubtitleParser'])).genericSubtitleParser.pages['example.com']).toEqual({
        enabled: false,
        aggressiveEnabled: true,
    });
});
