import type { VideoDataSubtitleTrackDef } from '@project/common';

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

export interface NpoStreamSubtitles {
    productId: string;
    tracks: VideoDataSubtitleTrackDef[];
}

// Reads the subtitle list out of a prod.npoplayer.nl stream-link response.
export const npoStreamLinkSubtitles = (value: any): NpoStreamSubtitles | undefined => {
    const productId = value?.metadata?.prid;
    const subtitles = value?.assets?.subtitles;

    if (typeof productId !== 'string' || !Array.isArray(subtitles)) {
        return undefined;
    }

    const tracks: VideoDataSubtitleTrackDef[] = [];

    for (const subtitle of subtitles) {
        if (typeof subtitle?.location !== 'string' || typeof subtitle?.iso !== 'string') {
            continue;
        }

        const name = typeof subtitle.name === 'string' && subtitle.name.trim() ? subtitle.name.trim() : subtitle.iso;
        tracks.push({
            label: subtitle.aiGenerated === true ? `${name} (AI)` : name,
            language: subtitle.iso,
            url: subtitle.location,
            extension: 'vtt',
        });
    }

    return { productId, tracks };
};

// Teletext-style captions carry things that don't belong in a mined sentence: a page-number cue ("888"),
// colour tags (<c.yellow>), upper-case speaker labels ("ALLEN:") and upper-case notes ("MUZIEK",
// "LIVEPROGRAMMA, ONDERTITELING KAN ACHTERLOPEN").
const speakerLabel = /^(?:[-–]\s*)?[A-ZÀ-Þ][A-ZÀ-Þ'. -]{1,30}:\s+/;
const teletextPage = /^\d{3}$/;
const upperCaseNote = /^(?=.*[A-ZÀ-Þ]{3})[^a-zß-ÿ]+$/;
const entities: { [entity: string]: string } = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

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
            .filter((line) => line.length > 0 && !teletextPage.test(line) && !upperCaseNote.test(line));

        if (text.length === 0) {
            continue;
        }

        out.push(String(++index), lines[timingIndex], ...text, '');
    }

    return out.join('\n');
};
