import type { VideoData, VideoDataSubtitleTrackDef } from '@project/common';

import { trackFromDef } from '@/pages/util';

declare global {
    interface XMLHttpRequest {
        _asbCrunchyrollUrl?: string;
        _asbCrunchyrollListenerAttached?: boolean;
    }
}

export default defineUnlistedScript(() => {
    const tracks = new Map<string, VideoDataSubtitleTrackDef>();

    let selectorRequested = false;
    let syncRequestInProgress = false;
    let lastError = '';

    function sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
        });
    }

    function currentBasename(): string {
        return document.title.replace(/\s*-\s*Watch on Crunchyroll\s*$/i, '').trim();
    }

    function languageLabel(language: string): string {
        const normalized = language.toLowerCase();

        if (normalized.startsWith('en')) {
            return 'English';
        }

        if (normalized.startsWith('pt')) {
            return 'Português';
        }

        if (normalized.startsWith('es')) {
            return 'Español';
        }

        if (normalized.startsWith('ja')) {
            return '日本語';
        }

        return language;
    }

    function publish(): void {
        const detail: VideoData = {
            error: lastError,
            basename: currentBasename(),
            subtitles: [...tracks.values()].map(trackFromDef),
        };

        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail }));
    }

    function registerTrack(definition: VideoDataSubtitleTrackDef): void {
        /*
         * A chave não contém a URL porque as URLs
         * assinadas mudam a cada carregamento.
         */
        const key = [definition.language, definition.label, definition.extension].join(':');

        const previous = tracks.get(key);

        tracks.set(key, definition);

        if (previous?.url !== definition.url) {
            console.info(`[asbplayer Crunchyroll] Faixa detectada: ${definition.label}`);
        }

        /*
         * Atualiza o seletor quando uma faixa chega
         * depois da primeira resposta.
         */
        if (selectorRequested && !syncRequestInProgress) {
            publish();
        }
    }

    function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }

        return value as Record<string, unknown>;
    }

    /*
     * Detecta a legenda ASS comum na resposta JSON
     * de /playback/v3/.../play.
     */
    function inspectPlaybackJson(value: unknown): void {
        const root = recordFromUnknown(value);

        if (root === undefined) {
            return;
        }

        const data = recordFromUnknown(root.data);

        const subtitleValue = root.subtitles ?? data?.subtitles;

        const subtitles = recordFromUnknown(subtitleValue);

        if (subtitles === undefined) {
            return;
        }

        for (const [key, rawTrack] of Object.entries(subtitles)) {
            if (key.toLowerCase() === 'none') {
                continue;
            }

            const track = recordFromUnknown(rawTrack);

            if (track === undefined) {
                continue;
            }

            const url = typeof track.url === 'string' ? track.url : undefined;

            const language = typeof track.language === 'string' ? track.language : key;

            const extension =
                typeof track.format === 'string' ? track.format.toLowerCase().replace(/^\./, '') : undefined;

            if (url === undefined || extension === undefined || language.toLowerCase() === 'none') {
                continue;
            }

            registerTrack({
                label: languageLabel(language),
                language,
                url,
                extension,
            });
        }
    }

    function elementText(element: Element | undefined): string | undefined {
        const text = element?.textContent?.trim();

        return text === undefined || text === '' ? undefined : text;
    }

    /*
     * Analisa o manifest.mpd e extrai as faixas
     * WebVTT marcadas como caption.
     */
    function inspectManifest(manifestText: string, manifestUrl: string): void {
        if (!/<MPD[\s>]/i.test(manifestText)) {
            return;
        }

        const xmlDocument = new DOMParser().parseFromString(manifestText, 'application/xml');

        if (xmlDocument.getElementsByTagName('parsererror').length > 0) {
            console.warn('[asbplayer Crunchyroll] Manifesto XML inválido');

            return;
        }

        const adaptationSets = Array.from(xmlDocument.getElementsByTagNameNS('*', 'AdaptationSet'));

        let detectedCount = 0;

        for (const adaptationSet of adaptationSets) {
            const mimeType = (adaptationSet.getAttribute('mimeType') ?? '').toLowerCase();

            const contentType = (adaptationSet.getAttribute('contentType') ?? '').toLowerCase();

            const isTextTrack = mimeType.includes('text/vtt') || contentType === 'text';

            if (!isTextTrack) {
                continue;
            }

            const roleValues = Array.from(adaptationSet.getElementsByTagNameNS('*', 'Role')).map((role) => {
                return (role.getAttribute('value') ?? '').toLowerCase();
            });

            const isCaption = roleValues.some((role) => {
                return role.includes('caption');
            });

            if (!isCaption) {
                continue;
            }

            const language = adaptationSet.getAttribute('lang') ?? 'und';

            const originalLabel = adaptationSet.getAttribute('label') ?? languageLabel(language);

            const label = /\[CC\]$/i.test(originalLabel) ? originalLabel : `${originalLabel} [CC]`;

            const representations = Array.from(adaptationSet.getElementsByTagNameNS('*', 'Representation'));

            const nodes = representations.length > 0 ? representations : [adaptationSet];

            for (const node of nodes) {
                const representationBaseUrl = node.getElementsByTagNameNS('*', 'BaseURL')[0];

                const adaptationBaseUrl = adaptationSet.getElementsByTagNameNS('*', 'BaseURL')[0];

                const rawUrl = elementText(representationBaseUrl ?? adaptationBaseUrl);

                if (rawUrl === undefined) {
                    continue;
                }

                const resolvedUrl = new URL(rawUrl, manifestUrl).href;

                if (!/\.vtt(?:\?|$)/i.test(resolvedUrl)) {
                    continue;
                }

                registerTrack({
                    label,
                    language,
                    url: resolvedUrl,
                    extension: 'vtt',
                });

                detectedCount++;
            }
        }

        if (detectedCount > 0) {
            console.info(`[asbplayer Crunchyroll] ${detectedCount} faixa(s) CC encontrada(s) no manifesto`);
        }
    }

    function isManifestUrl(url: string): boolean {
        return /manifest\.mpd(?:\?|$)/i.test(url);
    }

    function isPlaybackUrl(url: string): boolean {
        return /\/playback\/v3\//i.test(url) && /\/play(?:\?|$)/i.test(url);
    }

    /*
     * Interceptação por XMLHttpRequest.
     *
     * Esta é a parte que faltava: o player pode
     * carregar o manifest.mpd por XHR, não por fetch.
     */
    const originalXhrOpen = window.XMLHttpRequest.prototype.open;

    window.XMLHttpRequest.prototype.open = function (...args: Parameters<typeof originalXhrOpen>) {
        const rawUrl = args[1];

        try {
            const url =
                typeof rawUrl === 'string'
                    ? new URL(rawUrl, window.location.href).href
                    : rawUrl instanceof URL
                      ? rawUrl.href
                      : String(rawUrl);

            this._asbCrunchyrollUrl = url;

            if (!this._asbCrunchyrollListenerAttached) {
                this._asbCrunchyrollListenerAttached = true;

                this.addEventListener('load', () => {
                    const responseUrl = this._asbCrunchyrollUrl ?? '';

                    if (!isManifestUrl(responseUrl)) {
                        return;
                    }

                    let responseText = '';

                    try {
                        if (typeof this.responseText === 'string') {
                            responseText = this.responseText;
                        }
                    } catch {
                        // responseText não está
                        // disponível para alguns
                        // responseTypes.
                    }

                    if (responseText === '' && typeof this.response === 'string') {
                        responseText = this.response;
                    }

                    if (responseText === '' && this.responseXML !== null) {
                        responseText = new XMLSerializer().serializeToString(this.responseXML);
                    }

                    if (responseText !== '') {
                        console.info('[asbplayer Crunchyroll] Manifesto capturado por XHR');

                        inspectManifest(responseText, responseUrl);
                    }
                });
            }
        } catch (error) {
            console.debug('[asbplayer Crunchyroll] Não foi possível analisar uma URL XHR:', error);
        }

        // Mantém o comportamento original do site.
        return originalXhrOpen.call(this, ...args);
    } as typeof originalXhrOpen;

    /*
     * Interceptação por fetch para a resposta JSON
     * de playback e também como alternativa para MPD.
     */
    const originalFetch = window.fetch;

    window.fetch = function (...args: Parameters<typeof originalFetch>) {
        const [input] = args;
        let requestUrl = '';

        try {
            requestUrl =
                typeof input === 'string'
                    ? new URL(input, window.location.href).href
                    : input instanceof URL
                      ? input.href
                      : input.url;
        } catch {
            requestUrl = '';
        }

        const responsePromise = originalFetch.call(this, ...args);

        if (isManifestUrl(requestUrl) || isPlaybackUrl(requestUrl)) {
            void responsePromise
                .then((response: Response) => {
                    return response
                        .clone()
                        .text()
                        .then((text) => {
                            if (isManifestUrl(requestUrl)) {
                                console.info('[asbplayer Crunchyroll] Manifesto capturado por fetch');

                                inspectManifest(text, response.url || requestUrl);

                                return;
                            }

                            try {
                                inspectPlaybackJson(JSON.parse(text));
                            } catch {
                                // Não era JSON válido.
                            }
                        });
                })
                .catch(() => {
                    // Nunca deixa a interceptação
                    // quebrar o player.
                });
        }

        return responsePromise;
    };

    /*
     * Fallback para manifestos que já foram carregados
     * antes da instalação dos interceptadores.
     */
    async function scanExistingManifests(): Promise<void> {
        const manifestUrls = [
            ...new Set(
                performance
                    .getEntriesByType('resource')
                    .map((entry) => entry.name)
                    .filter(isManifestUrl)
            ),
        ];

        /*
         * Os últimos recursos tendem a pertencer ao
         * episódio atualmente aberto.
         */
        for (const manifestUrl of manifestUrls.slice(-3)) {
            try {
                const parsedUrl = new URL(manifestUrl);

                const credentials: RequestCredentials =
                    parsedUrl.origin === window.location.origin ? 'include' : 'omit';

                const response = await originalFetch.call(window, manifestUrl, { credentials });

                if (!response.ok) {
                    console.warn(`[asbplayer Crunchyroll] Manifesto retornou HTTP ${response.status}`);

                    continue;
                }

                const text = await response.text();

                inspectManifest(text, response.url || manifestUrl);
            } catch (error) {
                console.debug('[asbplayer Crunchyroll] Não foi possível reler um manifesto:', error);
            }
        }
    }

    function hasClosedCaption(): boolean {
        return [...tracks.values()].some((track) => {
            return track.extension === 'vtt' && /\[CC\]/i.test(track.label);
        });
    }

    async function waitForClosedCaption(timeoutMilliseconds = 5000): Promise<void> {
        const startedAt = Date.now();

        while (!hasClosedCaption() && Date.now() - startedAt < timeoutMilliseconds) {
            await sleep(100);
        }
    }

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            selectorRequested = true;
            syncRequestInProgress = true;
            lastError = '';

            void (async () => {
                await scanExistingManifests();

                /*
                 * Dá tempo para o player emitir o XHR
                 * do manifesto quando o episódio acabou
                 * de começar.
                 */
                await waitForClosedCaption();

                if (tracks.size === 0) {
                    lastError = 'Nenhuma legenda foi detectada. Recarregue o episódio, dê play e tente novamente.';
                }

                syncRequestInProgress = false;
                publish();
            })().catch((error: unknown) => {
                lastError = error instanceof Error ? error.message : String(error);

                syncRequestInProgress = false;

                console.error('[asbplayer Crunchyroll]', error);

                publish();
            });
        },
        false
    );

    console.info('[asbplayer Crunchyroll] Detector ASS + CC com XHR iniciado');
});
