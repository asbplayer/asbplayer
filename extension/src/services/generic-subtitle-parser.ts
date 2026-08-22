import type { GlobalStateProvider } from '@project/common/global-state';

export async function genericSubtitleParserOptionsForHost(globalState: GlobalStateProvider, host: string) {
    const { genericSubtitleParser } = await globalState.get(['genericSubtitleParser']);
    const page = genericSubtitleParser.pages[host];
    return {
        enabled: page?.enabled === true,
        aggressiveEnabled: page?.aggressiveEnabled === true,
    };
}

export async function setGenericSubtitleParserOptionsForHost(
    globalState: GlobalStateProvider,
    host: string,
    enabled: boolean,
    aggressiveEnabled: boolean
) {
    const { genericSubtitleParser } = await globalState.get(['genericSubtitleParser']);
    if (
        genericSubtitleParser.pages[host]?.enabled === enabled &&
        genericSubtitleParser.pages[host]?.aggressiveEnabled === aggressiveEnabled
    ) {
        return;
    }

    await globalState.set({
        genericSubtitleParser: {
            ...genericSubtitleParser,
            pages: {
                ...genericSubtitleParser.pages,
                [host]: {
                    ...genericSubtitleParser.pages[host],
                    enabled,
                    aggressiveEnabled,
                },
            },
        },
    });
}
