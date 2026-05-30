const disneyPlusPageConfigKeys = new Set(['disneyPlus', 'appsDisneyPlus']);

export function isDisneyPlusPageConfigKey(pageConfigKey: string | undefined): boolean {
    return pageConfigKey !== undefined && disneyPlusPageConfigKeys.has(pageConfigKey);
}
