export interface Fetcher<TRequest = any, TResponse = any> {
    fetch: (url: string, request: TRequest) => Promise<TResponse>;
}

export class HttpFetcher implements Fetcher {
    async fetch(url: string, request: any) {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(request),
        });
        return response.json();
    }
}
