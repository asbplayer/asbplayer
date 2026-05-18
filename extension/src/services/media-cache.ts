import { AudioModel, ImageModel } from '@project/common';

export interface CachedMediaRecord {
    subtitleStart: number;
    subtitleEnd: number;
    audioModel?: AudioModel;
    imageModel?: ImageModel;
}

export default class MediaCache {
    private readonly _byTab = new Map<string, CachedMediaRecord>();

    key(tabId: number, src: string) {
        return `${tabId}:${src}`;
    }

    get(key: string): CachedMediaRecord | undefined {
        return this._byTab.get(key);
    }

    set(key: string, record: CachedMediaRecord) {
        this._byTab.set(key, record);
    }
}
