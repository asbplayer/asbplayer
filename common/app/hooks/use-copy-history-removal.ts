import { useEffect } from 'react';
import type { CopyHistoryRemovedMessage } from '@project/common';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import { asbTrace } from '@project/common/util/log';

export const useCopyHistoryRemoval = (
    extension: Pick<ChromeExtension, 'subscribe' | 'id'>,
    remove: (ids?: readonly string[]) => void
) => {
    useEffect(
        () =>
            extension.subscribe(({ data }) => {
                if (data.command === 'copy-history-removed') {
                    const { ids } = data as CopyHistoryRemovedMessage;
                    asbTrace('copy-history', 'Received history removal', { appId: extension.id, ids: ids ?? 'all' });
                    remove(ids);
                }
            }),
        [extension, remove]
    );
};
