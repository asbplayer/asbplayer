import type {
    AddProfileMessage,
    DictionaryBuildAnkiCacheMessage,
    DictionaryGetAllTokensMessage,
    DictionaryDeleteProfileMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionaryRequestStatisticsGenerationMessage,
    DictionaryRequestStatisticsSnapshotMessage,
    DictionaryRequestStatisticsMineSentencesMessage,
    DictionaryRequestStatisticsSeekMessage,
    DictionarySaveRecordLocalBulkMessage,
    DictionaryExportRecordLocalBulkMessage,
    DictionaryImportRecordLocalBulkMessage,
    DictionaryStatisticsMessage,
    GetGlobalStateMessage,
    GetSettingsMessage,
    RemoveProfileMessage,
    RequestCopyHistoryMessage,
    RequestCopyHistoryResponse,
    RequestSubtitlesResponse,
    SetActiveProfileMessage,
    SetGlobalStateMessage,
    SetSettingsMessage,
    ExtensionVersionMessage,
    DictionaryUpdateRecordsMessage,
    DictionaryDeleteRecordsMessage,
    DictionaryGetRecordsMessage,
} from '@project/common';
import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import type { ContentScriptContext } from '#imports';

const matches = ['*://app.asbplayer.dev/*'];

if (import.meta.env.DEV) {
    matches.push('*://localhost/*');
}

export default defineContentScript({
    // Set manifest options
    matches,
    allFrames: true,
    runAt: 'document_start',

    main(ctx: ContentScriptContext) {
        const sendMessageToPlayer = (message: any) => {
            window.postMessage({
                sender: 'asbplayer-extension-to-player',
                message,
            });
        };

        const dictionaryStorage = new ExtensionDictionaryStorage();
        const settingsStorage = new ExtensionSettingsStorage();
        const globalStateProvider = new ExtensionGlobalStateProvider();

        window.addEventListener('message', async (event) => {
            if (event.source !== window) {
                return;
            }

            const command = event.data;

            if (command.sender === 'asbplayer' || command.sender === 'asbplayerv2') {
                switch (command.message.command) {
                    case 'get-settings':
                        const getSettingsMessage = command.message as GetSettingsMessage;
                        sendMessageToPlayer({
                            response: await settingsStorage.get(getSettingsMessage.keysAndDefaults),
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'set-settings':
                        const setSettingsMessage = command.message as SetSettingsMessage;
                        await settingsStorage.set(setSettingsMessage.settings);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'get-active-profile':
                        sendMessageToPlayer({
                            response: await settingsStorage.activeProfile(),
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'set-active-profile':
                        const setActiveProfileMessage = command.message as SetActiveProfileMessage;
                        await settingsStorage.setActiveProfile(setActiveProfileMessage.name);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'get-profiles':
                        sendMessageToPlayer({
                            response: await settingsStorage.profiles(),
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'add-profile':
                        const addProfileMessage = command.message as AddProfileMessage;
                        await settingsStorage.addProfile(addProfileMessage.name);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'remove-profile':
                        const removeProfileMessage = command.message as RemoveProfileMessage;
                        await settingsStorage.removeProfile(removeProfileMessage.name);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'dictionary-get-bulk': {
                        const { profile, track, tokens } = command.message as DictionaryGetBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.getBulk(profile, track, tokens),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-get-by-lemma-bulk': {
                        const { profile, track, lemmas } = command.message as DictionaryGetByLemmaBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.getByLemmaBulk(profile, track, lemmas),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-save-record-local-bulk': {
                        const { profile, localTokenInputs, applyStates } =
                            command.message as DictionarySaveRecordLocalBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.saveRecordLocalBulk(
                                profile,
                                localTokenInputs,
                                applyStates
                            ),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-delete-record-local-bulk': {
                        const { profile, tokens } = command.message as DictionaryDeleteRecordLocalBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.deleteRecordLocalBulk(profile, tokens),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-delete-profile': {
                        const { profile } = command.message as DictionaryDeleteProfileMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.deleteProfile(profile),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-export-record-local-bulk': {
                        const message = command.message as DictionaryExportRecordLocalBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.exportRecordLocalBulk(),
                            messageId: message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-import-record-local-bulk': {
                        const message = command.message as DictionaryImportRecordLocalBulkMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.importRecordLocalBulk(message.records, message.profiles),
                            messageId: message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-get-records': {
                        const { profile, track } = command.message as DictionaryGetRecordsMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.getRecords(profile, track),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-update-records': {
                        const { profile, updates, applyStates } = command.message as DictionaryUpdateRecordsMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.updateRecords(profile, updates, applyStates),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-delete-records': {
                        const { profile, tokenKeys } = command.message as DictionaryDeleteRecordsMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.deleteRecords(profile, tokenKeys),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-build-anki-cache': {
                        const { profile, settings } = command.message as DictionaryBuildAnkiCacheMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.buildAnkiCache(profile, settings),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-get-all-tokens': {
                        const { profile, track } = command.message as DictionaryGetAllTokensMessage;
                        sendMessageToPlayer({
                            response: await dictionaryStorage.getAllTokens(profile, track),
                            messageId: command.message.messageId,
                        });
                        break;
                    }
                    case 'dictionary-statistics': {
                        const { mediaId, snapshot } = command.message as DictionaryStatisticsMessage;
                        await dictionaryStorage.publishStatisticsSnapshot(mediaId, snapshot);
                        break;
                    }
                    case 'dictionary-request-statistics-snapshot': {
                        const { mediaId } = command.message as DictionaryRequestStatisticsSnapshotMessage;
                        await dictionaryStorage.requestStatisticsSnapshot(mediaId);
                        break;
                    }
                    case 'dictionary-request-statistics-generation': {
                        const { mediaId } = command.message as DictionaryRequestStatisticsGenerationMessage;
                        await dictionaryStorage.requestStatisticsGeneration(mediaId);
                        break;
                    }
                    case 'dictionary-request-statistics-seek': {
                        const { mediaId, timestamp } = command.message as DictionaryRequestStatisticsSeekMessage;
                        await dictionaryStorage.requestStatisticsSeek(mediaId, timestamp);
                        break;
                    }
                    case 'dictionary-request-statistics-mine-sentences': {
                        const { mediaId, indexes } = command.message as DictionaryRequestStatisticsMineSentencesMessage;
                        await dictionaryStorage.requestStatisticsMineSentences(mediaId, indexes);
                        break;
                    }
                    case 'request-subtitles':
                        sendMessageToPlayer({
                            response: (await browser.runtime.sendMessage(command)) as
                                | RequestSubtitlesResponse
                                | undefined,
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'save-token-local':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({ messageId: command.message.messageId });
                        break;
                    case 'request-copy-history':
                        const requestCopyHistoryRequest = command.message as RequestCopyHistoryMessage;
                        sendMessageToPlayer({
                            response: (await browser.runtime.sendMessage(command)) as
                                | RequestCopyHistoryResponse
                                | undefined,
                            messageId: requestCopyHistoryRequest.messageId,
                            count: requestCopyHistoryRequest.count,
                        });
                        break;
                    case 'save-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'delete-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'clear-copy-history':
                        await browser.runtime.sendMessage(command);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'get-global-state':
                        const getGlobalStateMessage = command.message as GetGlobalStateMessage;
                        const { keys } = getGlobalStateMessage;
                        sendMessageToPlayer({
                            response:
                                keys === undefined
                                    ? await globalStateProvider.getAll()
                                    : await globalStateProvider.get(keys),
                            messageId: command.message.messageId,
                        });
                        break;
                    case 'set-global-state':
                        const setGlobalStateMessage = command.message as SetGlobalStateMessage;
                        await globalStateProvider.set(setGlobalStateMessage.state);
                        sendMessageToPlayer({
                            messageId: command.message.messageId,
                        });
                        break;
                    default:
                        browser.runtime.sendMessage(command);
                        break;
                }
            }
        });

        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.sender === 'asbplayer-extension-to-player') {
                window.postMessage(request);
            }
        });

        const manifest = browser.runtime.getManifest();

        window.addEventListener('DOMContentLoaded', async (e) => {
            const commandsPromise = browser.runtime.sendMessage({
                sender: 'asbplayerv2',
                message: {
                    command: 'extension-commands',
                },
            });

            const pageConfigPromise = browser.runtime.sendMessage({
                sender: 'asbplayerv2',
                message: {
                    command: 'page-config',
                },
            });

            const browserFeaturesPromise = browser.runtime.sendMessage({
                sender: 'asbplayerv2',
                message: {
                    command: 'browser-features',
                },
            });

            const versionMessage: ExtensionVersionMessage = {
                command: 'version',
                version: manifest.version,
                extensionCommands: await commandsPromise,
                pageConfig: await pageConfigPromise,
                browserFeatures: await browserFeaturesPromise,
            };

            sendMessageToPlayer(versionMessage);
        });
    },
});
