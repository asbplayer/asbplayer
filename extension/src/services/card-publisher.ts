import {
    CardExportedMessage,
    CardModel,
    CardSavedMessage,
    CardUpdatedMessage,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    PostMineAction,
    ShowAnkiUiMessage,
    ShowCardSelectUiMessage,
} from '@project/common';
import { humanReadableTime } from '@project/common/util';
import { AnkiSettings, ankiSettingsKeys, SettingsProvider } from '@project/common/settings';
import { v4 as uuidv4 } from 'uuid';
import { exportCard, DuplicateNoteError } from '@project/common/anki';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';

export class CardPublisher {
    private readonly _settingsProvider: SettingsProvider;
    bulkExportCancelled = false;

    constructor(settingsProvider: SettingsProvider) {
        this._settingsProvider = settingsProvider;
    }

    async publish(card: CardModel, postMineAction?: PostMineAction, tabId?: number, src?: string) {
        const id = uuidv4();
        const savePromise = this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        try {
            if (postMineAction == PostMineAction.showAnkiDialog) {
                this._showAnkiDialog(card, id, src, tabId);
            } else if (postMineAction == PostMineAction.updateLastCard) {
                await this._updateLastCard(card, src, tabId);
            } else if (postMineAction === PostMineAction.showUpdateCardDialog) {
                this._showUpdateCardDialog(card, src, tabId);
            } else if (postMineAction === PostMineAction.exportCard) {
                await this._exportCard(card, src, tabId);
            } else if (postMineAction === PostMineAction.none) {
                this._notifySaved(savePromise, card, src, tabId);
            }
        } catch (e) {
            this._notifyError(e, src, tabId);
            throw e;
        }
    }

    async publishBulk(card: CardModel, tabId?: number, src?: string) {
        const id = uuidv4();
        // (agloo) n.b. this could lead to out-of-order card saves if Anki is taking a while,
        // which matters to users if they plan on reviewing cards in save order. If we get reports of this,
        // consider putting a promise from here into a save queue.
        this._saveCardToRepository(id, card);

        if (tabId === undefined || src === undefined) {
            return;
        }

        if (this.bulkExportCancelled) {
            return;
        }

        await this._exportCardBulk(card, src, tabId);
    }

    private _notifySaved(savePromise: Promise<any>, card: CardModel, src: string, tabId: number) {
        savePromise.then((saved: boolean) => {
            if (saved) {
                const cardSavedCommand: ExtensionToVideoCommand<CardSavedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        ...card,
                        command: 'card-saved',
                        cardName: card.subtitle.text || humanReadableTime(card.mediaTimestamp),
                    },
                    src: src,
                };

                browser.tabs.sendMessage(tabId, cardSavedCommand);
            }
        });
    }

    private async _exportCard(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;
        const cardName = await exportCard(card, ankiSettings, 'default');

        const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-exported',
                cardName: `${cardName}`,
            },
            src,
        };

        browser.tabs.sendMessage(tabId, cardExportedCommand);
    }

    private async _exportCardBulk(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;

        let cardName: string = '';
        try {
            cardName = await exportCard(card, ankiSettings, 'default');
        } catch (e) {
            if (e instanceof DuplicateNoteError) {
                // This shouldn't be reachable right now, since we've allowed duplicate note exports.
                // It's left in because without it we'd halt a bulk export on the first duplicate we
                // find, and duplicates are very easy to encounter on shorter sentences.
                const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        ...card,
                        command: 'card-exported',
                        cardName: '',
                        isBulkExport: true,
                        skippedDuplicate: true,
                    },
                    src,
                };
                browser.tabs.sendMessage(tabId, cardExportedCommand);
                return;
            }
            // If we're in the middle of a bulk export, a failure will hang the app.
            // Signal an error and keep going to avoid this.
            const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    ...card,
                    command: 'card-exported',
                    cardName: '',
                    isBulkExport: true,
                    skippedDuplicate: false,
                    exportError: e instanceof Error ? e.message : 'Unknown error',
                },
                src,
            };
            browser.tabs.sendMessage(tabId, cardExportedCommand);
            return;
        }

        const cardExportedCommand: ExtensionToVideoCommand<CardExportedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-exported',
                cardName: `${cardName}`,
                isBulkExport: true,
            },
            src,
        };

        browser.tabs.sendMessage(tabId, cardExportedCommand);
        browser.runtime.sendMessage(cardExportedCommand);
    }

    private async _updateLastCard(card: CardModel, src: string | undefined, tabId: number) {
        const ankiSettings = (await this._settingsProvider.get(ankiSettingsKeys)) as AnkiSettings;
        const cardName = await exportCard(card, ankiSettings, 'updateLast');

        const cardUpdatedCommand: ExtensionToVideoCommand<CardUpdatedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'card-updated',
                cardName: `${cardName}`,
            },
            src,
        };

        browser.tabs.sendMessage(tabId, cardUpdatedCommand);
    }

    private _showAnkiDialog(card: CardModel, id: string, src: string | undefined, tabId: number) {
        const showAnkiUiCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                id,
                command: 'show-anki-ui',
            },
            src,
        };

        browser.tabs.sendMessage(tabId, showAnkiUiCommand);
    }

    private _showUpdateCardDialog(card: CardModel, src: string | undefined, tabId: number) {
        const showCardSelectUiCommand: ExtensionToVideoCommand<ShowCardSelectUiMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                ...card,
                command: 'show-card-select-ui',
            },
            src,
        };

        browser.tabs.sendMessage(tabId, showCardSelectUiCommand);
    }

    private async _saveCardToRepository(id: string, card: CardModel) {
        try {
            const storageLimit = await this._settingsProvider.getSingle('miningHistoryStorageLimit');
            new IndexedDBCopyHistoryRepository(storageLimit).save({
                ...card,
                id: card.id ?? id,
                timestamp: Date.now(),
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    private _notifyError(e: unknown, src: string | undefined, tabId: number) {
        let message: string;

        if (e instanceof Error) {
            message = e.message;
        } else if (typeof e === 'string') {
            message = e;
        } else {
            message = String(e);
        }

        const notifyErrorCommand: ExtensionToVideoCommand<NotifyErrorMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'notify-error',
                message,
            },
            src,
        };
        browser.tabs.sendMessage(tabId, notifyErrorCommand);
    }
}
