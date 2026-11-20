import project from '@project/common/project';

const { host, port } = project.services.transcriber;

export const localTranscriberUrl = (path: string, key: string) =>
    new URL(`http://${host}:${port}/${path}?${new URLSearchParams({ key })}`);

export type TranscriptionJob = {
    state: 'queued' | 'running' | 'done' | 'error';
    progress: number;
    error?: string;
};

export type TranscriptionResponse = { error?: string; job?: TranscriptionJob };
