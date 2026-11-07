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

/** Restores each source occurrence with its playback slot index, retaining all parts of a track. */
export function restoreSessionFiles(record: FileSessionRecord, resolvedFiles: FileWithId[]): MediaSourceFile[] {
    const files = [...resolvedFiles, ...(record.cachedSubtitleFiles ?? [])];
    if (record.subtitleTrackIds === undefined) {
        // Sessions without a saved arrangement treat each subtitle file as its own track.
        let track = 0;
        return files.map((source) => (source.id === record.videoHandle?.id ? source : { ...source, track: track++ }));
    }

    const filesById = new Map(files.map((file) => [file.id, file]));
    const subtitleSourceFiles = record.subtitleTrackIds.flatMap((ids, track) =>
        (ids.length > 0 ? ids : ['-']).map((id) => ({
            ...((id === '-' ? undefined : filesById.get(id)) ?? { id: '-', file: new File([], '.srt') }),
            track,
        }))
    );

    return [...resolvedFiles.filter(({ id }) => id === record.videoHandle?.id), ...subtitleSourceFiles];
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
