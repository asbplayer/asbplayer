import { asbError } from '@project/common/util';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { isFirefoxBuild } from '@project/extension/src/services/build-flags';

export interface ExtensionConfig {
    latest: {
        version: string;
        url: string;
    };
    languages: LocalizationConfig[];
    ttl?: number;
}

export interface LocalizationConfig {
    code: string;
    url: string;
    version: number;
}

const settings = new SettingsProvider(new ExtensionSettingsStorage());

// As of this writing, session storage is not accessible to content scripts on Firefox so we use local storage instead.
// Since unlike session storage, local storage is not automatically cleared, we clear it manually once a day.
const storage = isFirefoxBuild ? browser.storage.local : browser.storage.session;
const firefoxTtl = 3600 * 24 * 1000; // 1 day

export const fetchExtensionConfig = async (noCache = false): Promise<ExtensionConfig | undefined> => {
    if (!noCache) {
        const result = await storage.get(['config']);
        const cachedConfig = result ? result.config : undefined;

        if (cachedConfig === '-' || cachedConfig === null) {
            return undefined;
        }

        if (cachedConfig !== undefined) {
            const config = cachedConfig as ExtensionConfig;
            if (typeof config.ttl !== 'number' || Date.now() < config.ttl) {
                return config;
            }
        }
    }

    try {
        const asbplayerUrl = await settings.getSingle('streamingAppUrl');
        const extensionJsonUrl = `${asbplayerUrl}/extension.json`;
        const extensionJson = await (await fetch(extensionJsonUrl)).json();

        if (validJson(extensionJson)) {
            if (isFirefoxBuild) {
                extensionJson.ttl = Date.now() + firefoxTtl;
            }

            await storage.set({ config: extensionJson });
            return extensionJson as ExtensionConfig;
        }
    } catch (e) {
        asbError({ asbLogLabel: 'config' }, e);
    }

    return undefined;
};

const validJson = (json: any | undefined) => {
    return json !== undefined && validLatest(json.latest) && validLanguages(json.languages);
};

const validLatest = (json: any | undefined) => {
    return typeof json.version === 'string' && typeof json.url === 'string';
};

const validLanguages = (json: any | undefined) => {
    if (json === undefined || typeof json !== 'object' || !Array.isArray(json)) {
        return false;
    }

    for (const item of json) {
        if (typeof item.code !== 'string' || typeof item.url !== 'string' || typeof item.version !== 'number') {
            return false;
        }
    }

    return true;
};
