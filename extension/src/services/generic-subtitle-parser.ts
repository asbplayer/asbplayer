import type { GenericParseType, GlobalStateProvider } from '@project/common/global-state';

export async function genericSubtitleParserOptionsForHost(globalState: GlobalStateProvider, host: string) {
    const { genericSubtitleParser } = await globalState.get(['genericSubtitleParser']);
    const page = genericSubtitleParser.pages[host];
    return {
        parse: page?.parse ?? 'off',
    };
}

export async function setGenericSubtitleParserOptionsForHost(
    globalState: GlobalStateProvider,
    host: string,
    parse: GenericParseType
) {
    const { genericSubtitleParser } = await globalState.get(['genericSubtitleParser']);
    if (genericSubtitleParser.pages[host]?.parse === parse) return;
    await globalState.set({
        genericSubtitleParser: {
            ...genericSubtitleParser,
            pages: {
                ...genericSubtitleParser.pages,
                [host]: {
                    ...genericSubtitleParser.pages[host],
                    parse,
                },
            },
        },
    });
}
