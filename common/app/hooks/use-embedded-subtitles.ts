import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { asbError } from '@project/common/util/log';

export const useEmbeddedSubtitles = ({
    source,
    host,
    open,
    discoveryKey,
    discoverOnLoad,
}: {
    source: FileWithId | undefined;
    host: SubtitleHost;
    open: boolean;
    discoveryKey?: object;
    discoverOnLoad: boolean;
}) => {
    const service = useMemo(() => new EmbeddedSubtitles(host), [host]);
    const [catalog, setCatalog] = useState<{ file: File; tracks: EmbeddedSubtitleTrack[] }>();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const request = useRef<AbortController>(undefined);
    const cancel = useCallback(() => {
        request.current?.abort();
        request.current = undefined;
        setLoading(false);
    }, []);
    useEffect(() => {
        cancel();
        setCatalog(undefined);
        setError(false);
        return () => request.current?.abort();
    }, [source?.file, service, cancel]);
    const discover = useCallback(async () => {
        if (!source) return;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const { signal } = controller;
        setLoading(true);
        setError(false);
        try {
            const tracks = await service.discover(source, signal);
            if (!signal.aborted) setCatalog({ file: source.file, tracks });
        } catch (error) {
            if (!signal.aborted) {
                asbError('app/subtitles', 'Failed to discover embedded subtitles:', error);
                setError(true);
            }
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [source, service]);
    useEffect(() => {
        if (open || discoverOnLoad) void discover();
        else cancel();
    }, [open, discoverOnLoad, discover, cancel, discoveryKey]);
    return {
        service,
        cancel,
        loading,
        error,
        tracks: catalog?.file === source?.file ? catalog?.tracks : undefined,
    };
};
