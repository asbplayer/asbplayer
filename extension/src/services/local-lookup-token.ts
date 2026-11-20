export const localLookupTokenKey = 'localLookupToken';

export const getLocalLookupToken = async (): Promise<string> => {
    const { [localLookupTokenKey]: token } = await browser.storage.local.get({ [localLookupTokenKey]: '' });
    return typeof token === 'string' ? token : '';
};
