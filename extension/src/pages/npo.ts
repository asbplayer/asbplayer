// NPO Start (npo.nl/start) streams captions inside the DASH stream, so generic detection only finds the
// seek-bar thumbnail VTT. The same captions are published as WebVTT by NPO's public POMS API, keyed by the
// episode's productId (e.g. KN_1695321), which NPO's own program-detail endpoint returns for a page slug.

export const npoEpisodeSlug = (pathname: string): string | undefined => {
    const match = /^\/start\/afspelen\/([^/?#]+)/.exec(pathname);
    return match ? decodeURIComponent(match[1]) : undefined;
};

export const npoProgramDetailUrl = (slug: string) =>
    `https://npo.nl/start/api/domain/program-detail?slug=${encodeURIComponent(slug)}`;

export const npoSubtitleUrl = (productId: string, language = 'nl_NL') =>
    `https://rs.poms.omroep.nl/v1/api/subtitles/${encodeURIComponent(productId)}/${language}/CAPTION.vtt`;

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

// Teletext captions carry a page-number cue ("888") and upper-case speaker labels ("ALLEN:", "YVON:").
// Both end up in mined sentences, so strip them.
const speakerLabel = /^(?:[-–]\s*)?[A-ZÀ-Þ][A-ZÀ-Þ'. -]{1,30}:\s+/;
const teletextPage = /^\d{3}$/;

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
            .map((line) => line.replace(speakerLabel, '').trim())
            .filter((line) => line.length > 0 && !teletextPage.test(line));

        if (text.length === 0) {
            continue;
        }

        out.push(String(++index), lines[timingIndex], ...text, '');
    }

    return out.join('\n');
};
