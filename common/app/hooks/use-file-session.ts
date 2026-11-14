import { asbError } from '@project/common/util/log';
import { useCallback, useEffect, useState } from 'react';
import type { FileWithId } from '@project/common/file-selector';
import type { LoadableSubtitleTrack } from '@project/common';
import type {
    FileSessionRecord,
    FileSessionSourceIds,
    FileSystemFileHandleWithId,
} from '@project/common/file-system-access';
import {
    canRestoreSession,
    IndexedDBFileSessionRepository,
    supportsFileSystemAccess,
} from '@project/common/file-system-access';

let _repository: IndexedDBFileSessionRepository | undefined;
const getRepository = () => {
    if (_repository === undefined && supportsFileSystemAccess()) {
        _repository = new IndexedDBFileSessionRepository();
    }
    return _repository;
};

export const useFileSession = () => {
    const fileSessionRepository = getRepository();
    const [canRestoreLastSession, setCanRestoreLastSession] = useState<boolean>(false);

    useEffect(() => {
        if (!fileSessionRepository) return;
        void fileSessionRepository
            .fetch()
            .then((record) => {
                if (canRestoreSession(record)) setCanRestoreLastSession(true);
            })
            .catch((error) => {
                asbError('app/session', 'Failed to inspect the last file session:', error);
            });
    }, [fileSessionRepository]);

    const saveSession = useCallback(
        async ({ videoHandle, subtitleHandles }: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles'>) => {
            if (!fileSessionRepository) return;

            if (!videoHandle && subtitleHandles.length === 0) {
                return;
            }

            await fileSessionRepository.merge({ videoHandle, subtitleHandles });
            setCanRestoreLastSession(true);
        },
        [fileSessionRepository]
    );

    const fetchSession = useCallback(() => fileSessionRepository?.fetch(), [fileSessionRepository]);

    const clearSession = useCallback(async () => {
        await fileSessionRepository?.clear();
        setCanRestoreLastSession(false);
    }, [fileSessionRepository]);

    const saveBufferedHandlesToSession = useCallback(
        async (bufferedSubtitleHandles: FileSystemFileHandleWithId[]) => {
            await fileSessionRepository?.merge({
                subtitleHandles: [],
                bufferedSubtitleHandles: bufferedSubtitleHandles,
            });
        },
        [fileSessionRepository]
    );
    const promoteBufferedHandlesInSession = useCallback(
        async (ids: string[]) => {
            await fileSessionRepository?.promoteBuffered(ids);
        },
        [fileSessionRepository]
    );

    const clearBufferedHandlesInSession = useCallback(async () => {
        await fileSessionRepository?.clearBuffered();
    }, [fileSessionRepository]);

    const saveSubtitleSelection = useCallback(
        async (tracks: LoadableSubtitleTrack<FileWithId>[], pendingEmbeddedIds: ReadonlySet<string>) => {
            if (!fileSessionRepository) return;
            const completedTracks = tracks.map(({ fileParts }) => ({
                fileParts: fileParts.filter((file) => !pendingEmbeddedIds.has(file.id)),
            }));
            const files = completedTracks.flatMap(({ fileParts }) => fileParts);
            await fileSessionRepository.setCachedSubtitleFiles(files, {
                subtitleTrackIds: completedTracks.map(({ fileParts }) => fileParts.map(({ id }) => id)),
                embeddedSubtitles: Object.fromEntries(
                    files.filter((file) => file.embedded).map((file) => [file.id, file.embedded!])
                ),
            });
            setCanRestoreLastSession(true);
        },
        [fileSessionRepository]
    );

    useEffect(() => {
        void fileSessionRepository?.clearBuffered();
    }, [fileSessionRepository]);

    const retainSourcesInSession = useCallback(
        async (sources: FileSessionSourceIds) => {
            await fileSessionRepository?.retain(sources);
        },
        [fileSessionRepository]
    );

    return {
        saveSubtitleSelection,
        canRestoreLastSession,
        saveSession,
        fetchSession,
        clearSession,
        saveBufferedHandlesToSession,
        promoteBufferedHandlesInSession,
        clearBufferedHandlesInSession,
        retainSourcesInSession,
    };
};
