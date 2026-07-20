export type FilesCallback = (files: FileWithId[]) => void;
export type Unsubscriber = () => void;
export type FileWithId = { file: File; id: string };

export interface FileSelector {
    open: () => void;
    onFilesSelected: (callback: FilesCallback) => Unsubscriber;
}

export class DefaultFileSelector {
    private readonly _callbacks: FilesCallback[] = [];
    private readonly _opener: () => void | Promise<FileWithId[] | undefined>;

    constructor(opener: () => void | Promise<FileWithId[] | undefined>) {
        this._opener = opener;
    }

    open() {
        const promiseOrVoid = this._opener();
        if (promiseOrVoid instanceof Promise) {
            void promiseOrVoid.then((files) => {
                if (files !== undefined) {
                    this.publishFiles(files);
                }
            });
        }
    }

    onFilesSelected(callback: FilesCallback): Unsubscriber {
        this._callbacks.push(callback);
        return () => {
            for (let i = this._callbacks.length - 1; i >= 0; --i) {
                if (callback === this._callbacks[i]) {
                    this._callbacks.splice(i, 1);
                    break;
                }
            }
        };
    }

    publishFiles(files: FileWithId[]) {
        for (const c of this._callbacks) {
            c(files);
        }
    }
}
