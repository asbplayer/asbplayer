import { Command, HttpPostMessage, Message } from '@project/common';

const allowedKeys = ['version', 'action', 'params', 'text', 'scanLength', 'parser', 'term'];
const allowedActions = [
    'areSuspended',
    'guiAddCards',
    'deckNames',
    'modelNames',
    'modelFieldNames',
    'findCards',
    'findNotes',
    'getIntervals',
    'guiBrowse',
    'requestPermission',
    'cardsInfo',
    'cardsModTime',
    'notesInfo',
    'notesModTime',
    'updateNoteFields',
    'addNote',
    'storeMediaFile',
    'version',
    'addTags',
];

export default class HttpPostHandler {
    constructor() {}

    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab', 'asbplayer-popup'];
    }

    get command() {
        return 'http-post';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as HttpPostMessage;

        if (!this._validateBody(message.body)) {
            sendResponse({ error: 'Invalid request' });
            return;
        }

        fetch(message.url, {
            method: 'POST',
            body: JSON.stringify(message.body),
        })
            .then((response) => response.json())
            .then((json) => sendResponse(json))
            .catch((e) => sendResponse({ error: e.message }));

        return true;
    }

    private _validateBody(body: any) {
        if (body === null) return true;

        const bodyKeys = Object.keys(body);

        for (const k of bodyKeys) {
            if (!allowedKeys.includes(k)) {
                return false;
            }
        }

        const version = body['version'];

        if (version !== undefined && typeof version !== 'number') {
            return false;
        }

        const action = body['action'];

        if (action !== undefined && !allowedActions.includes(action)) {
            return false;
        }

        return true;
    }
}
