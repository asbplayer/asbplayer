import { useCallback, useEffect, useState } from 'react';
import {
    FileSessionRecord,
    FileSystemFileHandleWithId,
    IndexedDBFileSessionRepository,
    supportsFileSystemAccess,
} from '../../file-system-access';

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
        void fileSessionRepository.fetch().then((record) => {
            if (record && (record.videoHandle || record.subtitleHandles.length > 0)) {
                setCanRestoreLastSession(true);
            }
        });
    }, [fileSessionRepository]);

    const saveSession = useCallback(
        async ({ videoHandle, subtitleHandles }: Omit<FileSessionRecord, 'id' | 'timestamp'>) => {
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

    useEffect(() => {
        void fileSessionRepository?.clearBuffered();
    }, [fileSessionRepository]);

    const retainHandlesInSession = useCallback(
        async (ids: string[]) => {
            await fileSessionRepository?.retain(ids);
        },
        [fileSessionRepository]
    );

    return {
        canRestoreLastSession,
        saveSession,
        fetchSession,
        clearSession,
        saveBufferedHandlesToSession,
        promoteBufferedHandlesInSession,
        clearBufferedHandlesInSession,
        retainHandlesInSession,
    };
};
