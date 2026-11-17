import type { Fetcher } from '@project/common';
import { HttpFetcher } from '@project/common';

export interface YomitanFetcher {
    fetch: (action: string, body: object) => Promise<any>;
}

export class HttpYomitanFetcher implements YomitanFetcher {
    private readonly baseUrl: string;
    private readonly fetcher: Fetcher;

    constructor(baseUrl: string, fetcher: Fetcher = new HttpFetcher()) {
        this.baseUrl = baseUrl;
        this.fetcher = fetcher;
    }

    async fetch(action: string, body: object) {
        return this.fetcher.fetch(`${this.baseUrl}/${action}`, body);
    }
}
