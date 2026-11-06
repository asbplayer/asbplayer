import type { CopyHistoryChangedMessage, ExtensionToAsbPlayerCommand } from '@project/common';
import { asbError, asbTrace } from '@project/common/util/log';
import type TabRegistry from '@project/extension/src/services/tab-registry';

export const publishCopyHistoryChanged = async (tabRegistry: Pick<TabRegistry, 'publishCommandToAsbplayers'>) => {
    const command: ExtensionToAsbPlayerCommand<CopyHistoryChangedMessage> = {
        sender: 'asbplayer-extension-to-player',
        message: { command: 'copy-history-changed' },
    };
    asbTrace('copy-history', 'Publishing history change after storage update');
    try {
        await tabRegistry.publishCommandToAsbplayers({ commandFactory: () => command });
    } catch (error) {
        asbError('copy-history', 'Failed to notify apps about changed history:', error);
    }
};
