import { useCallback, useEffect, useState } from 'react';
import { IndexedDBFileSessionRepository, supportsFileSystemAccess } from '../../file-system-access';

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
        fileSessionRepository.fetch().then((record) => {
            if (record && (record.videoHandle || record.subtitleHandles.length > 0)) {
                setCanRestoreLastSession(true);
            }
        });
    }, [fileSessionRepository]);

    const saveSession = useCallback(
        async ({
            videoHandle,
            subtitleHandles,
        }: {
            videoHandle?: FileSystemFileHandle;
            subtitleHandles: FileSystemFileHandle[];
        }) => {
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

    return {
        canRestoreLastSession,
        saveSession,
        fetchSession,
        clearSession,
    };
};
