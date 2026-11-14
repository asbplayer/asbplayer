import { afterEach, beforeEach, expect, it } from '@jest/globals';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Message } from '@project/common';
import VideoChannel from '@project/common/app/services/video-channel';
import type { VideoProtocol, VideoProtocolMessage } from '@project/common/app/services/video-protocol';
import { useSubtitlePickerPlayback } from '@project/common/app/hooks/use-subtitle-picker-playback';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class Protocol implements VideoProtocol {
    readonly sent: Message[] = [];
    onMessage?: (message: VideoProtocolMessage) => void;
    echoPlaybackRequests = false;

    postMessage(message: Message) {
        this.sent.push(message);
        if (this.echoPlaybackRequests && (message.command === 'play' || message.command === 'pause')) {
            this.receive({ command: message.command, echo: false });
        }
    }

    close() {}

    receive(message: Message) {
        this.onMessage?.({ data: message });
    }

    ready(paused: boolean) {
        this.receive({ command: 'ready', paused, currentTime: 12, duration: 100, playbackRate: 1 });
    }

    get commands() {
        return this.sent.map(({ command }) => command);
    }
}

const Harness = ({ open, channel }: { open: boolean; channel: VideoChannel | undefined }) => {
    useSubtitlePickerPlayback(open, channel);
    return null;
};

let root: Root;
let container: HTMLDivElement;
let protocol: Protocol;
let channel: VideoChannel;

const render = async (open: boolean, activeChannel: VideoChannel | undefined = channel, strict = false) => {
    const picker = <Harness open={open} channel={activeChannel} />;
    await act(async () => root.render(strict ? <StrictMode>{picker}</StrictMode> : picker));
};

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    protocol = new Protocol();
    channel = new VideoChannel(protocol);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

it.each([false, true])('restores paused=%s on close without seeking or changing playback rate', async (paused) => {
    protocol.ready(paused);
    await render(false);
    expect(protocol.commands).toEqual([]);
    await render(true);
    expect(protocol.commands).toEqual(['pause']);
    protocol.receive({ command: 'pause', echo: false });
    await render(true);
    await render(false);
    expect(protocol.commands).toEqual(['pause', paused ? 'pause' : 'play']);
    await render(false);
    expect(protocol.commands).toHaveLength(2);
});

it('captures the latest playback state and resamples it on each opening', async () => {
    protocol.ready(true);
    protocol.receive({ command: 'play', echo: false });
    await render(true);
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'play']);
    protocol.receive({ command: 'pause', echo: false });
    await render(true);
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'play', 'pause', 'pause']);
});

it('restores playing even when the picker closes before the pause is acknowledged', async () => {
    protocol.ready(false);
    await render(true);
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'play']);
});

it('waits for media readiness while open and keeps the state before its own pause', async () => {
    await render(true);
    expect(protocol.commands).toEqual([]);
    await act(async () => protocol.ready(false));
    await act(async () => protocol.ready(true));
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'pause', 'play']);
});

it('does not pause media that only becomes ready after the picker closes', async () => {
    await render(true);
    await render(false);
    await act(async () => protocol.ready(false));
    expect(protocol.commands).toEqual([]);
});

it('handles a channel created after opening and restores that channel’s initial state', async () => {
    await act(async () => root.render(<Harness open channel={undefined} />));
    protocol.ready(false);
    await render(true);
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'play']);
});

it('does not transfer the old media’s playing state to a replacement while open', async () => {
    protocol.ready(false);
    await render(true);
    const replacementProtocol = new Protocol();
    const replacement = new VideoChannel(replacementProtocol);
    replacementProtocol.ready(true);
    await render(true, replacement);
    await render(false, replacement);
    expect(protocol.commands).toEqual(['pause']);
    expect(replacementProtocol.commands).toEqual(['pause', 'pause']);
});

it('does not resume old media when the channel changes as the picker closes', async () => {
    protocol.ready(false);
    await render(true);
    const replacementProtocol = new Protocol();
    const replacement = new VideoChannel(replacementProtocol);
    replacementProtocol.ready(true);
    await render(false, replacement);
    expect(protocol.commands).toEqual(['pause']);
    expect(replacementProtocol.commands).toEqual([]);
});

it('does not resume a closed channel or restore playback after unmounting', async () => {
    protocol.ready(false);
    await render(true);
    channel.close();
    await render(false);
    expect(protocol.commands).toEqual(['pause', 'close']);
    const next = new Protocol();
    const nextChannel = new VideoChannel(next);
    next.ready(false);
    await render(true, nextChannel);
    await act(async () => root.render(null));
    next.ready(false);
    expect(next.commands).toEqual(['pause']);
});

it('retains the original playing state across Strict Mode effect replay', async () => {
    protocol.echoPlaybackRequests = true;
    protocol.ready(false);
    await render(true, channel, true);
    await render(false, channel, true);
    expect(protocol.commands.at(-1)).toBe('play');
    expect(protocol.commands.filter((command) => command === 'play')).toHaveLength(1);
});
