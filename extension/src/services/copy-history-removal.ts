import type { CopyHistoryRemovedMessage, ExtensionToAsbPlayerCommand } from '@project/common';
import { asbError, asbTrace } from '@project/common/util/log';
import type TabRegistry from '@project/extension/src/services/tab-registry';

export const publishCopyHistoryRemoval = async (
    tabRegistry: Pick<TabRegistry, 'publishCommandToAsbplayers'>,
    ids?: string[]
) => {
    if (ids?.length === 0) return;
    const command: ExtensionToAsbPlayerCommand<CopyHistoryRemovedMessage> = {
        sender: 'asbplayer-extension-to-player',
        message: { command: 'copy-history-removed', ids },
    };
    asbTrace('copy-history', 'Publishing history removal after storage update', { ids: ids ?? 'all' });
    try {
        await tabRegistry.publishCommandToAsbplayers({ commandFactory: () => command });
    } catch (error) {
        asbError('copy-history', 'Failed to notify apps about removed history:', error);
    }
};
