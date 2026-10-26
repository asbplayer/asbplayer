import type { SubtitleTrack } from '@project/common/src/model';

export type { SubtitleTrack };

export interface MineSubtitleCommand {
    command: 'mine-subtitle';
    messageId: string;
    body: {
        fields: { [key: string]: string };
        postMineAction: number;
        mediaId?: string;
        noteId?: number;
    };
}

export interface Response<T> {
    command: 'response';
    messageId: string;
    body: T;
}

export interface MineSubtitleResponseBody {
    published: boolean;
}

export type LoadSubtitlesResponseBody = Record<string, never>;

export interface SubtitleFile {
    base64: string;
    name: string;
}

export interface LoadSubtitlesCommand {
    command: 'load-subtitles';
    messageId: string;
    body: {
        files?: SubtitleFile[];
        mediaId?: string;
    };
}

export interface SeekTimestampCommand {
    command: 'seek-timestamp';
    messageId: string;
    body: {
        timestamp: number;
        mediaId?: string;
    };
}

export interface GetBoundMediaCommand {
    command: 'get-bound-media';
    messageId: string;
    body: Record<string, never>;
}

export interface BoundMedia {
    id: string; // Derived from a hash of `streaming:<tabId>:<src>` or `local:<asbplayerId>`.
    type: 'streaming' | 'local';
    title?: string;
    faviconUrl?: string;
    loadedSubtitles: SubtitleTrack[];
    active: boolean;
}

export interface GetBoundMediaResponseBody {
    media: BoundMedia[];
}

export interface GetSubtitlesCommand {
    command: 'get-subtitles';
    messageId: string;
    body: {
        mediaId?: string;
        trackNumbers?: number[];
    };
}

export interface SubtitleCue {
    text: string;
    start: number;
    end: number;
    track: number;
}

export interface GetSubtitlesResponseBody {
    subtitles: SubtitleCue[];
}

// Commands are shared with the WebSocket server integration: the external connection port and the
// WebSocket servers carry the same method names and payloads, framed as JSON-RPC 2.0 (see
// ./external-api.ts) or, on the WebSocket servers only, the legacy `{command, messageId, body}`
// framing during the migration.

export type ExternalCommand =
    | MineSubtitleCommand
    | LoadSubtitlesCommand
    | SeekTimestampCommand
    | GetBoundMediaCommand
    | GetSubtitlesCommand;

export interface ExternalCommandHandlers {
    onMineSubtitle: (command: MineSubtitleCommand) => Promise<boolean>;
    onLoadSubtitles: (command: LoadSubtitlesCommand) => Promise<void>;
    onSeekTimestamp: (command: SeekTimestampCommand) => Promise<void>;
    onGetBoundMedia: () => Promise<BoundMedia[]>;
    onGetSubtitles: (mediaId: string | undefined, trackNumbers: number[] | undefined) => Promise<SubtitleCue[]>;
}
