import pagesConfig from '@project/extension/src/pages.json';
import type { PublicPath } from 'wxt/browser';
import { isOnTutorialPage } from '@project/extension/src/services/tutorial';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { SettingsProvider } from '@project/common/settings';
import type { SettingsFormPageConfig, PageSettings } from '@project/common/settings';
import type { GenericParseType } from '@project/common/global-state';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { genericSubtitleParserOptionsForHost } from '@project/extension/src/services/generic-subtitle-parser';

interface PageConfigFile {
    pages: PageConfig[];
}

export const genericPageScript = 'generic-page.js';
export const aggressiveGenericPageScript = 'aggressive-generic-page.js';

export interface PageConfig {
    // Regex for URLs where script should be loaded
    host: string;

    // Hosts specified as literal strings, not to be evaluated as regexes
    literalHosts?: string[];

    // Key to link this config with page-specific settings
    key?: string;

    // Page script to load
    pageScript?: string;

    // Whether this is the generic fallback used for otherwise unsupported pages
    generic?: boolean;

    // Whether a changed media source identifies a new video even when the page URL is unchanged
    videoSrcChangesIndicateNewVideo?: boolean;

    // URL relative path regex where subtitle track data syncing is allowed
    syncAllowedAtPath?: string;

    // URL hash segment regex where subtitle track data syncing is allowed
    syncAllowedAtHash?: string;

    // Whether shadow roots should be searched for video elements on this page
    searchShadowRootsForVideoElements?: boolean;

    // Whether video elements with blank src should be bindable on this page
    allowVideoElementsWithBlankSrc?: boolean;

    // CSS selector for preferred videos that may auto-sync and should sort first in manual video selection
    preferredVideoElementSelector?: string;

    autoSync?: {
        // Whether to attempt to load detected subtitles automatically
        enabled: boolean;

        // Video src string regex for video elements that should be considered for auto-sync
        videoSrc?: string;

        // Video element ID regex for video elements that should be considered for auto-sync
        elementId?: string;
    };

    ignoreVideoElements?: {
        // CSS classes that should cause video elements to be ignored for binding
        class?: string;
        // Styles that should cause video elements to be ignored for binding
        style?: { [key: string]: string };
    };

    // Whether to hide "remember track preferences" toggle
    hideRememberTrackPreferenceToggle?: boolean;
}

const settings = new SettingsProvider(new ExtensionSettingsStorage());
const globalState = new ExtensionGlobalStateProvider();

async function pageConfigsMergedWithSettingsOverrides(): Promise<PageConfigFile> {
    const pageSettings = await settings.getSingle('streamingPages');
    const mergedPages = pagesConfig.pages.map((page) => {
        const settingsPage = pageSettings[page.key as keyof PageSettings];
        const overrides = settingsPage.overrides;

        if (overrides === undefined) {
            return {
                ...page,
                literalHosts: settingsPage.additionalHosts,
            };
        }

        const autoSyncHasOverrides =
            (overrides.autoSyncEnabled ?? overrides.autoSyncVideoSrc ?? overrides.autoSyncElementId) !== undefined;
        const autoSync = autoSyncHasOverrides
            ? {
                  enabled: overrides.autoSyncEnabled ?? page.autoSync?.enabled ?? false,
                  videoSrc: overrides.autoSyncVideoSrc ?? page.autoSync?.videoSrc,
                  elementId: overrides.autoSyncElementId ?? page.autoSync?.elementId,
              }
            : page.autoSync;

        return {
            ...page,
            literalHosts: settingsPage.additionalHosts,
            syncAllowedAtPath: overrides.syncAllowedAtPath ?? page.syncAllowedAtPath,
            syncAllowedAtHash: overrides.syncAllowedAtHash ?? page.syncAllowedAtHash,
            searchShadowRootsForVideoElements:
                overrides.searchShadowRootsForVideoElements ?? page.searchShadowRootsForVideoElements,
            allowVideoElementsWithBlankSrc:
                overrides.allowVideoElementsWithBlankSrc ?? page.allowVideoElementsWithBlankSrc,
            autoSync,
        };
    });

    return { pages: mergedPages };
}

export async function currentPageDelegate(): Promise<PageDelegate> {
    const urlObj = new URL(window.location.href);
    const [mergedPageConfig, genericSubtitleParserOptions] = await Promise.all([
        pageConfigsMergedWithSettingsOverrides(),
        genericSubtitleParserOptionsForHost(globalState, urlObj.host),
    ]);
    return pageDelegateForUrl(mergedPageConfig.pages, urlObj, {
        tutorial: isOnTutorialPage(),
        genericSubtitleParser: genericSubtitleParserOptions.parse,
    });
}

interface PageDelegateOptions {
    tutorial: boolean;
    genericSubtitleParser: GenericParseType;
}

export function pageDelegateForUrl(
    pages: readonly PageConfig[],
    urlObj: URL,
    { tutorial, genericSubtitleParser }: PageDelegateOptions
): PageDelegate {
    const aggressiveGenericSubtitleParserEnabled = genericSubtitleParser === 'aggressive';
    const genericPageConfig = (page?: PageConfig): PageConfig => ({
        ...page,
        host: page?.host ?? urlObj.host,
        pageScript: aggressiveGenericSubtitleParserEnabled ? aggressiveGenericPageScript : genericPageScript,
        generic: true,
        searchShadowRootsForVideoElements:
            page?.searchShadowRootsForVideoElements ?? aggressiveGenericSubtitleParserEnabled,
        autoSync: { ...page?.autoSync, enabled: false },
    });

    for (const page of pages) {
        const regex = new RegExp(page.host);
        if (regex.test(urlObj.host) || (page.literalHosts !== undefined && page.literalHosts.includes(urlObj.host))) {
            if (page.pageScript !== undefined) return new PageDelegate(page, urlObj);
            return new PageDelegate(genericSubtitleParser !== 'off' ? genericPageConfig(page) : page, urlObj);
        }
    }

    if (tutorial) {
        return new PageDelegate(
            {
                host: urlObj.host,
                pageScript: 'asbplayer-tutorial-page.js',
                autoSync: {
                    enabled: false,
                },
            },
            urlObj
        );
    }

    return new PageDelegate(
        genericSubtitleParser !== 'off'
            ? genericPageConfig()
            : {
                  host: urlObj.host,
                  autoSync: { enabled: false },
              },
        urlObj
    );
}

export class PageDelegate {
    readonly config: PageConfig;
    readonly url: URL;

    constructor(config: PageConfig, url: URL) {
        this.config = config;
        this.url = url;
    }

    loadScripts() {
        if (this.config.pageScript === undefined) {
            return;
        }

        return injectPageScript(this.config.pageScript);
    }

    shouldIgnore(element: HTMLMediaElement) {
        if (this.config.ignoreVideoElements === undefined) {
            return false;
        }

        if (
            this.config.ignoreVideoElements.class !== undefined &&
            element.classList.contains(this.config.ignoreVideoElements.class)
        ) {
            return true;
        }

        if (this.config.ignoreVideoElements.style !== undefined) {
            for (const key of Object.keys(this.config.ignoreVideoElements.style)) {
                if (element.style[key as keyof CSSStyleDeclaration] === this.config.ignoreVideoElements.style[key]) {
                    return true;
                }
            }
        }

        return false;
    }

    videoElementPreference(element: HTMLMediaElement) {
        const selector = this.config.preferredVideoElementSelector;
        return selector === undefined || element.matches(selector) ? 0 : 1;
    }

    canAutoSync(element: HTMLMediaElement) {
        return (
            this.config.autoSync !== undefined &&
            this.config.autoSync.enabled &&
            (this.config.preferredVideoElementSelector === undefined ||
                element.matches(this.config.preferredVideoElementSelector)) &&
            (this.config.autoSync.elementId === undefined || element.id === this.config.autoSync.elementId) &&
            (this.config.autoSync.videoSrc === undefined || new RegExp(this.config.autoSync.videoSrc).test(element.src))
        );
    }

    isVideoPage() {
        let hashMatch = true;
        let pathMatch = true;
        if (this.config.syncAllowedAtHash) {
            hashMatch = new RegExp(this.config.syncAllowedAtHash).test(this.url.hash);
        }
        if (this.config.syncAllowedAtPath) {
            pathMatch = new RegExp(this.config.syncAllowedAtPath).test(this.url.pathname);
        }
        return hashMatch && pathMatch;
    }
}

export function injectPageScript(pageScript: string) {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(pageScript as PublicPath);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    return script;
}

export const settingsPageConfigs: { [K in keyof PageSettings]: SettingsFormPageConfig } = Object.fromEntries(
    pagesConfig.pages.map((config) => {
        const settingsFormPageConfig: SettingsFormPageConfig = {
            hostRegex: config.host,
            syncAllowedAtPath: config.syncAllowedAtPath,
            syncAllowedAtHash: config.syncAllowedAtHash,
            searchShadowRootsForVideoElements: config.searchShadowRootsForVideoElements,
            allowVideoElementsWithBlankSrc: config.allowVideoElementsWithBlankSrc,
            autoSyncEnabled: config.autoSync?.enabled,
            autoSyncVideoSrc: config.autoSync?.videoSrc,
            autoSyncElementId: config.autoSync?.elementId,
            ignoreVideoElementsClass: config.ignoreVideoElements?.class,
            faviconUrl: chrome.runtime.getURL(`/page-favicons/${config.key}.ico`),
        };
        return [config.key, settingsFormPageConfig];
    })
) as { [K in keyof PageSettings]: SettingsFormPageConfig };
