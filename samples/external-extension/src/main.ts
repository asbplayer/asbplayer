// SPDX-License-Identifier: Unlicense

import { ExternalApproval, ExternalConnection } from './connection';
import {
    BoundMedia,
    ExternalApprovalMessage,
    ExternalCommand,
    ExternalHelloMessage,
    GetBoundMediaResponseBody,
    GetSubtitlesResponseBody,
    PostMineAction,
    portName,
} from './protocol';

const selfName = 'asbplayer sample companion';

const sampleSrt = `1
00:00:00,000 --> 00:00:05,000
ねこ
`;
const sampleSrtBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(sampleSrt)));

const extensionIdInput = document.querySelector<HTMLInputElement>('#extension-id')!;
const connectButton = document.querySelector<HTMLButtonElement>('#connect')!;
const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnect')!;
const statusSpan = document.querySelector<HTMLSpanElement>('#status')!;
const logDiv = document.querySelector<HTMLDivElement>('#log')!;

const helloButton = document.querySelector<HTMLButtonElement>('#hello')!;
const getBoundMediaButton = document.querySelector<HTMLButtonElement>('#get-bound-media')!;
const mineSubtitleButton = document.querySelector<HTMLButtonElement>('#mine-subtitle')!;
const seekButton = document.querySelector<HTMLButtonElement>('#seek-timestamp')!;
const loadSubtitlesButton = document.querySelector<HTMLButtonElement>('#load-subtitles')!;
const getSubtitlesButton = document.querySelector<HTMLButtonElement>('#get-subtitles')!;

let connection: ExternalConnection | undefined;
let approval = new ExternalApproval((approved) => setStatus());
let polling: ReturnType<typeof setInterval> | undefined;
let awaitingApprovalLogged = false;
let lastMedia: BoundMedia | undefined;

function log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logDiv.appendChild(document.createTextNode(`[${timestamp}] ${message}\n`));
    logDiv.scrollTop = logDiv.scrollHeight;
}

function setStatus() {
    statusSpan.textContent =
        connection === undefined ? 'Not connected' : approval.approved ? 'Approved' : 'Awaiting approval...';

    for (const button of [
        getBoundMediaButton,
        mineSubtitleButton,
        seekButton,
        loadSubtitlesButton,
        getSubtitlesButton,
    ]) {
        button.disabled = connection === undefined;
    }
}

async function request<T>(command: ExternalCommand): Promise<void> {
    if (connection === undefined) {
        return;
    }

    const response = await connection.request<T>(command);

    if (response === undefined) {
        log(`<no response: ${command.messageId}>`);
        return;
    }

    log(`${JSON.stringify(response.body)}`);
}

async function getBoundMedia(): Promise<GetBoundMediaResponseBody | undefined> {
    if (connection === undefined) {
        return undefined;
    }

    const response = await connection.request<GetBoundMediaResponseBody>({
        command: 'get-bound-media',
        messageId: newId(),
        body: {},
    });

    if (response === undefined) {
        return undefined;
    }

    lastMedia = response.body.media[0];
    log(JSON.stringify(response.body));
    return response.body;
}

function newId() {
    return `msg-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function connect() {
    const asbplayerExtensionId = extensionIdInput.value.trim();

    if (asbplayerExtensionId === '') {
        log('Enter the asbplayer extension ID first (see chrome://extensions with developer mode on).');
        return;
    }

    void chrome.storage.local.set({ asbplayerExtensionId });

    let port: chrome.runtime.Port;

    try {
        port = chrome.runtime.connect(asbplayerExtensionId, { name: portName });
    } catch (error) {
        log(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    connection = new ExternalConnection(port);
    const newConnection = connection;
    awaitingApprovalLogged = false;
    approval = new ExternalApproval((approved) => {
        setStatus();
        awaitingApprovalLogged = false;
        log(approved ? 'Approved! Commands are now dispatched.' : 'Approval was removed or denied.');
        stopPolling();
        startPolling();
    });
    connection.onMessage((message) => {
        if ((message as { type?: string }).type === 'asbplayer-external-approval') {
            approval.update(message as ExternalApprovalMessage);
        }
    });
    connection.onDisconnect(() => {
        // A reconnect replaces the connection before the old port's disconnect event fires.
        if (connection !== newConnection) {
            return;
        }

        log('Disconnected from asbplayer.');
        teardown();
    });

    // Greet asbplayer; the response reflects the current approval state.
    const hello: ExternalHelloMessage = {
        type: 'asbplayer-external-hello',
        name: selfName,
        version: chrome.runtime.getManifest().version,
    };
    connection.post(hello);
    log(`Said hello as "${selfName}" to extension ${asbplayerExtensionId}. Waiting for approval if needed...`);

    connectButton.textContent = 'Reconnect';
    setStatus();
    startPolling();
}

function startPolling() {
    if (polling !== undefined || connection === undefined) {
        return;
    }

    // While unapproved, commands receive no response, so retry get-bound-media periodically
    // until approval arrives.
    polling = setInterval(() => {
        if (connection === undefined || connection.disconnected) {
            stopPolling();
            return;
        }

        if (approval.approved) {
            stopPolling();
            void getBoundMedia().then(() => log('Dispatch verified.'));
            return;
        }

        void getBoundMedia().then((media) => {
            if (media === undefined && polling !== undefined && !awaitingApprovalLogged) {
                awaitingApprovalLogged = true;
                log('(no response yet - still awaiting approval...)');
            }
        });
    }, 2000);
}

function stopPolling() {
    if (polling !== undefined) {
        clearInterval(polling);
        polling = undefined;
    }
}

function teardown() {
    connection = undefined;
    stopPolling();
    setStatus();
}

connectButton.addEventListener('click', () => {
    if (connection !== undefined) {
        connection.disconnect();
    }

    teardown();
    connect();
});

disconnectButton.addEventListener('click', () => {
    connection?.disconnect();
});

helloButton.addEventListener('click', () => {
    connection?.post({
        type: 'asbplayer-external-hello',
        name: selfName,
        version: chrome.runtime.getManifest().version,
    } satisfies ExternalHelloMessage);
    log('Re-sent hello frame.');
});

getBoundMediaButton.addEventListener('click', () => void getBoundMedia());

mineSubtitleButton.addEventListener('click', () => {
    log('Mining subtitle with sample fields...');
    void request<{ published: boolean }>({
        command: 'mine-subtitle',
        messageId: newId(),
        body: {
            fields: { word: 'ねこ', sentence: 'ねこ' },
            postMineAction: PostMineAction.showAnkiDialog,
            ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
        },
    });
});

seekButton.addEventListener('click', () => {
    void request({
        command: 'seek-timestamp',
        messageId: newId(),
        body: {
            timestamp: 30,
            ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
        },
    });
    log('Requested seek to 30s.');
});

loadSubtitlesButton.addEventListener('click', () => {
    void request({
        command: 'load-subtitles',
        messageId: newId(),
        body: {
            files: [{ base64: sampleSrtBase64, name: 'sample.srt' }],
            ...(lastMedia !== undefined ? { mediaId: lastMedia.id } : {}),
        },
    });
    log('Requested load of sample.srt.');
});

getSubtitlesButton.addEventListener('click', async () => {
    if (lastMedia === undefined) {
        log('Fetch bound media first to target a media source.');
        return;
    }

    await request<GetSubtitlesResponseBody>({
        command: 'get-subtitles',
        messageId: newId(),
        body: { mediaId: lastMedia.id },
    });
});

setStatus();

chrome.storage.local.get('asbplayerExtensionId').then((result) => {
    const id = (result as Record<string, string | undefined>).asbplayerExtensionId;

    if (id !== undefined && id !== '') {
        extensionIdInput.value = id;
        // Approval persists on the asbplayer side, so reconnect automatically (the port cannot
        // outlive the popup).
        connect();
    } else {
        log(
            'Enter the asbplayer extension ID and press Connect. Approve this extension from the asbplayer extension popup.'
        );
    }
});
