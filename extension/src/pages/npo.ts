// NPO Start (npo.nl/start) streams its video as DASH, and generic detection only finds the seek-bar thumbnail
// VTT. The player gets its subtitle list from the prod.npoplayer.nl stream-link response (assets.subtitles),
// and those files live on cdn.npoplayer.nl, keyed by the episode's productId (prid, e.g. AT_300024115).
// NPO's own program-detail endpoint maps the page slug to that productId.

export const npoEpisodeSlug = (pathname: string): string | undefined => {
    const match = /^\/start\/afspelen\/([^/?#]+)/.exec(pathname);
    return match ? decodeURIComponent(match[1]) : undefined;
};

export const npoProgramDetailUrl = (slug: string) =>
    `https://npo.nl/start/api/domain/program-detail?slug=${encodeURIComponent(slug)}`;

export const isNpoStreamLinkUrl = (url: string) => /^https:\/\/prod\.npoplayer\.nl\/stream-link(?:[?#]|$)/.test(url);

export const npoCdnSubtitleUrl = (productId: string, iso = 'nl') =>
    `https://cdn.npoplayer.nl/subtitles/${encodeURIComponent(iso)}/${encodeURIComponent(productId)}.vtt`;

// Older teletext captions are also published by the POMS API. It's a fallback for episodes the CDN lacks.
export const npoPomsSubtitleUrl = (productId: string) =>
    `https://rs.poms.omroep.nl/v1/api/subtitles/${encodeURIComponent(productId)}/nl_NL/CAPTION.vtt`;

export const npoBasename = (detail: any): string | undefined => {
    const title = typeof detail?.title === 'string' ? detail.title.trim() : '';
    const series = typeof detail?.series?.title === 'string' ? detail.series.title.trim() : '';

    if (!title) {
        return series || undefined;
    }

    if (series && !title.toLowerCase().startsWith(series.toLowerCase())) {
        return `${series} - ${title}`;
    }

    return title;
};

export interface NpoTrack {
    label: string;
    language: string;
    url: string;
}

export interface NpoStreamSubtitles {
    productId: string;
    tracks: NpoTrack[];
}

// Reads the subtitle list out of a prod.npoplayer.nl stream-link response. An empty list is a valid answer
// (the episode has no subtitles), so it is returned as such rather than as undefined.
export const npoStreamLinkSubtitles = (value: any): NpoStreamSubtitles | undefined => {
    const productId = value?.metadata?.prid;
    const subtitles = value?.assets?.subtitles;

    if (typeof productId !== 'string' || !Array.isArray(subtitles)) {
        return undefined;
    }

    const tracks: NpoTrack[] = [];

    for (const subtitle of subtitles) {
        if (typeof subtitle?.location !== 'string' || typeof subtitle?.iso !== 'string') {
            continue;
        }

        const name = typeof subtitle.name === 'string' && subtitle.name.trim() ? subtitle.name.trim() : subtitle.iso;
        tracks.push({
            label: subtitle.aiGenerated === true ? `${name} (AI)` : name,
            language: subtitle.iso,
            url: subtitle.location,
        });
    }

    return { productId, tracks };
};

// Resolves a subtitle file to the URL asbplayer should load (e.g. a cleaned data: URL), undefined when the file
// is missing or not a subtitle file. May reject on network errors.
export type NpoSubtitleLoader = (url: string) => Promise<string | undefined>;

// Picks the tracks to offer: every loadable track the player listed; if none, the Dutch CDN file; if missing,
// the POMS teletext captions. Resolves to an empty list when the episode has no subtitles anywhere.
export const npoTracks = async (
    productId: string,
    listed: NpoTrack[] | undefined,
    load: NpoSubtitleLoader
): Promise<NpoTrack[]> => {
    const tryLoad = async (url: string) => {
        try {
            return await load(url);
        } catch {
            return undefined;
        }
    };

    const loaded = await Promise.all(
        (listed ?? []).map(async (track) => {
            const url = await tryLoad(track.url);
            return url === undefined ? undefined : { ...track, url };
        })
    );
    const tracks = loaded.filter((track): track is NpoTrack => track !== undefined);

    if (tracks.length > 0) {
        return tracks;
    }

    for (const fallback of [npoCdnSubtitleUrl(productId), npoPomsSubtitleUrl(productId)]) {
        const url = await tryLoad(fallback);

        if (url !== undefined) {
            return [{ label: 'Nederlands', language: 'nl', url }];
        }
    }

    return [];
};

// Teletext-style captions carry things that don't belong in a mined sentence: the "888" page-number cue,
// colour tags (<c.yellow>), upper-case speaker labels ("ALLEN: Mayo!") and boilerplate or sound notes
// ("LIVEPROGRAMMA, ONDERTITELING KAN ACHTERLOPEN", "MUZIEK"). The rules are deliberately narrow so that
// shouted or upper-case dialogue ("NEE!", "LET OP: de deur gaat dicht.", "112") is kept.
const teletextPage = /^888$/;
// A speaker label is only stripped when the dialogue after it starts like a new sentence.
const speakerLabel = /^(?:[-–]\s*)?[A-ZÀ-Þ][A-ZÀ-Þ'. -]{1,30}:\s+(?=[A-ZÀ-Þ0-9"'‘“(¿¡])/;
const noteKeywords =
    /(?:^|[^A-ZÀ-Þ])(?:ONDERTITEL\w*|LIVEPROGRAMMA|TT888|MUZIEK|APPLAUS|GELACH|GEJUICH|GEZANG|ZINGT|ZINGEN|LACHT|LACHEN|GEROEP|GESCHREEUW|GEFLUIT|TUNE|LIEDJE)(?:$|[^A-ZÀ-Þ])/;
const lowerCase = /[a-zß-ÿ]/;
const entities: { [entity: string]: string } = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

const isNote = (line: string) => !lowerCase.test(line) && noteKeywords.test(line);

const cleanLine = (line: string) =>
    line
        .replace(/<[^>]*>/g, '')
        .replace(/&(?:amp|lt|gt|nbsp);/g, (entity) => entities[entity])
        .replace(speakerLabel, '')
        .trim();

export const cleanNpoVtt = (vtt: string): string => {
    const blocks = vtt
        .replace(/\r\n?/g, '\n')
        .trim()
        .split(/\n\s*\n/);
    const out = ['WEBVTT', ''];
    let index = 0;

    for (const block of blocks) {
        const lines = block.split('\n');
        const timingIndex = lines.findIndex((line) => line.includes('-->'));

        if (timingIndex === -1) {
            continue;
        }

        const text = lines
            .slice(timingIndex + 1)
            .map(cleanLine)
            .filter((line) => line.length > 0 && !teletextPage.test(line) && !isNote(line));

        if (text.length === 0) {
            continue;
        }

        out.push(String(++index), lines[timingIndex], ...text, '');
    }

    return out.join('\n');
};

// Cleans a downloaded subtitle file into a data: URL, or undefined if it isn't a WebVTT file with cues
// (e.g. an HTML error page served with status 200).
export const npoVttDataUrl = (text: string): string | undefined => {
    if (!/^\s*WEBVTT/.test(text) || !text.includes('-->')) {
        return undefined;
    }

    const vtt = cleanNpoVtt(text);
    return vtt.includes('-->') ? `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}` : undefined;
};
