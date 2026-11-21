/**
 * File System Access API helpers (Chrome-only).
 * Provides showOpenFilePicker-based file selection that returns FileSystemFileHandle objects,
 * and utilities to re-acquire permissions and resolve handles back to File objects on revisit.
 */

import type { FileWithId } from '@project/common/file-selector';
import type { MediaSourceFile } from '@project/common/app/services/media-sources';
import type {
    FileSessionRecord,
    FileSystemFileHandleWithId,
} from '@project/common/file-system-access/file-system-access-repository';
import { subtitleSourceMatches } from '@project/common/embedded-subtitles/subtitle-source';
import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import { asbError } from '@project/common/util/log';
import { v4 as uuidv4 } from 'uuid';

export function supportsFileSystemAccess(): boolean {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function requestPermissions(
    handles: FileSystemFileHandleWithId[]
): Promise<{ granted: FileSystemFileHandleWithId[]; denied: FileSystemFileHandleWithId[] }> {
    const granted: FileSystemFileHandleWithId[] = [];
    const denied: FileSystemFileHandleWithId[] = [];

    for (const handle of handles) {
        try {
            const state = await (handle.handle as any).queryPermission?.({ mode: 'read' });
            if (state === 'granted') {
                granted.push(handle);
                continue;
            }
        } catch {
            // queryPermission not supported, fall through to requestPermission
        }

        try {
            const state = await (handle.handle as any).requestPermission?.({ mode: 'read' });
            if (state === 'granted') {
                granted.push(handle);
            } else {
                denied.push(handle);
            }
        } catch {
            denied.push(handle);
        }
    }

    return { granted, denied };
}

export async function resolveFiles(
    handles: FileSystemFileHandleWithId[]
): Promise<{ files: FileWithId[]; errors: FileSystemFileHandleWithId[] }> {
    const files: FileWithId[] = [];
    const errors: FileSystemFileHandleWithId[] = [];

    for (const handle of handles) {
        try {
            files.push({ id: handle.id, file: await handle.handle.getFile() });
        } catch {
            errors.push(handle);
        }
    }

    return { files, errors };
}

/** A session needs saved file contents or handles to offer restoration. */
export function canRestoreSession(record: FileSessionRecord | undefined): boolean {
    return (
        record !== undefined &&
        (record.videoHandle !== undefined ||
            record.subtitleHandles.length > 0 ||
            (record.cachedSubtitleFiles?.length ?? 0) > 0)
    );
}

/** Prepare missing embedded sources before reconstructing slots. The player extracts them later. */
export async function restoreSessionFiles(
    record: FileSessionRecord,
    resolvedFiles: FileWithId[],
    prepare: (source: FileWithId, descriptors: EmbeddedSubtitleDescriptor[]) => Promise<Map<string, FileWithId>>
): Promise<{ files: MediaSourceFile[]; missingEmbeddedSubtitles: EmbeddedSubtitleDescriptor[] }> {
    const video = resolvedFiles.find((file) => file.id === record.videoHandle?.id);
    const filesById = new Map(resolvedFiles.map((file) => [file.id, file]));
    // Files read from disk may have changed since the session was cached.
    for (const file of record.cachedSubtitleFiles ?? []) {
        if (!filesById.has(file.id)) filesById.set(file.id, file);
    }
    const pendingById = new Map<string, EmbeddedSubtitleDescriptor>();
    for (const [id, descriptor] of Object.entries(record.embeddedSubtitles ?? {})) {
        if (!video || !subtitleSourceMatches(video, descriptor)) {
            filesById.delete(id);
            continue;
        }
        const cached = filesById.get(id);
        if (descriptor.format === 'srt' && cached) {
            filesById.set(id, { ...cached, embedded: descriptor });
        } else {
            filesById.delete(id);
            pendingById.set(id, descriptor);
        }
    }
    const missing = [...pendingById.values()];
    if (video && missing.length) {
        try {
            for (const [id, file] of await prepare(video, missing)) filesById.set(id, file);
        } catch (error) {
            asbError('app/session', 'Failed to prepare embedded subtitles; preserving available session files:', error);
        }
    }
    if (!record.subtitleTrackIds) {
        // Sessions without a saved arrangement treat each subtitle file as its own track.
        let track = 0;
        return {
            files: [...filesById.values()].map((source) =>
                source.id === record.videoHandle?.id ? source : { ...source, track: track++ }
            ),
            missingEmbeddedSubtitles: missing,
        };
    }
    return {
        files: [
            ...(video ? [video] : []),
            ...record.subtitleTrackIds.flatMap((ids, track) =>
                (ids.length ? ids : ['-']).map((id) => ({
                    ...((id === '-' ? undefined : filesById.get(id)) ?? {
                        id: pendingById.has(id) ? id : '-',
                        embedded: pendingById.get(id),
                        file: new File([''], '.srt'),
                    }),
                    track,
                }))
            ),
        ],
        missingEmbeddedSubtitles: missing,
    };
}

export async function showFilePicker(extensions: {
    videoExtensions: string[];
    audioExtensions: string[];
    subtitleExtensions: string[];
}): Promise<FileSystemFileHandleWithId[] | undefined> {
    if (!supportsFileSystemAccess()) {
        return undefined;
    }

    try {
        const handles = await (window as any).showOpenFilePicker({
            multiple: true,
            types: [
                {
                    description: 'Media and subtitle files',
                    accept: {
                        'video/*': extensions.videoExtensions,
                        'audio/*': extensions.audioExtensions,
                        'text/*': extensions.subtitleExtensions,
                    },
                },
            ],
        });
        return (handles as FileSystemFileHandle[]).map((handle) => ({ handle, id: uuidv4() }));
    } catch (e: any) {
        if (e.name === 'AbortError') {
            return undefined;
        }
        throw e;
    }
}
