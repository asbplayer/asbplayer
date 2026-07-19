export interface Fetcher<TRequest = any, TResponse = any> {
    fetch: (url: string, request: TRequest) => Promise<TResponse>;
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
