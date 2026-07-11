export interface Fetcher {
    fetch: (url: string, body: any) => Promise<any>;
}

export class HttpFetcher implements Fetcher {
    async fetch(url: string, body: any) {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return response.json();
    }
}
