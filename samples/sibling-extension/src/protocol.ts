// Protocol types for asbplayer's external extension API, kept as a local copy so that a
// plugin extension only needs this file and never asbplayer's packages.
//
// Frames travel over a browser.runtime.connectExternal port named {@link portName}:
//
//   sibling -> asbplayer:
//     { type: 'asbplayer-external-identify', name?, version? }
//     { command: ExternalCommand['command'], messageId: string, body: object }
//   asbplayer -> sibling:
//     { type: 'asbplayer-external-authentication', approved: boolean }
//     { command: 'response', messageId: string, body: object }
//
// Commands are the same wire format the WebSocket server integration uses. Frames that
// are not dispatched (unknown commands, unapproved extensions) receive no response, so
// each request needs a timeout (see request.ts).

export const portName = 'asbplayer-external-v1';

export interface ExternalIdentifyMessage {
    readonly type: 'asbplayer-external-identify';
    /** Self-reported, untrusted display name shown next to the extension ID in asbplayer's approval UI. */
    readonly name?: string;
    readonly version?: string;
}

export interface ExternalAuthenticationMessage {
    readonly type: 'asbplayer-external-authentication';
    readonly approved: boolean;
}

export interface Response<T> {
    readonly command: 'response';
    readonly messageId: string;
    readonly body: T;
}

export interface MineSubtitleCommand {
    readonly command: 'mine-subtitle';
    readonly messageId: string;
    readonly body: {
        fields: { [key: string]: string };
        postMineAction: number;
        mediaId?: string;
        noteId?: number;
    };
}

export interface LoadSubtitlesCommand {
    readonly command: 'load-subtitles';
    readonly messageId: string;
    readonly body: {
        files?: { base64: string; name: string }[];
        mediaId?: string;
    };
}

export interface SeekTimestampCommand {
    readonly command: 'seek-timestamp';
    readonly messageId: string;
    readonly body: {
        timestamp: number;
        mediaId?: string;
    };
}

export interface GetBoundMediaCommand {
    readonly command: 'get-bound-media';
    readonly messageId: string;
    readonly body: Record<string, never>;
}

export interface BoundMedia {
    readonly id: string;
    readonly type: 'streaming' | 'local';
    readonly title?: string;
    readonly faviconUrl?: string;
    readonly loadedSubtitles: { track: number; fileName: string }[];
    readonly active: boolean;
}

export interface GetBoundMediaResponseBody {
    readonly media: BoundMedia[];
}

export interface GetSubtitlesCommand {
    readonly command: 'get-subtitles';
    readonly messageId: string;
    readonly body: {
        mediaId?: string;
        trackNumbers?: number[];
    };
}

export interface SubtitleCue {
    readonly text: string;
    readonly start: number;
    readonly end: number;
    readonly track: number;
}

export interface GetSubtitlesResponseBody {
    readonly subtitles: SubtitleCue[];
}

export type ExternalCommand =
    | MineSubtitleCommand
    | LoadSubtitlesCommand
    | SeekTimestampCommand
    | GetBoundMediaCommand
    | GetSubtitlesCommand;

// Post-mine actions, same values as asbplayer's PostMineAction enum.
export const PostMineAction = {
    none: 0,
    showAnkiDialog: 1,
    updateLastCard: 2,
    showUpdateCardDialog: 3,
    exportCard: 4,
} as const;
