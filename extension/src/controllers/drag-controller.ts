import ImageElement from '../services/image-element';
import Binding from '../services/binding';

export default class DragController {
    private readonly video: HTMLMediaElement;
    private readonly imageElement: ImageElement;

    private bound: boolean;
    private dragEnterElement: EventTarget | null = null;
    private bodyDragEnterElement: EventTarget | null = null;
    private dragElement?: HTMLDivElement;

    private dropListener?: (event: DragEvent) => void;
    private dragOverListener?: (event: DragEvent) => void;
    private dragEnterListener?: (event: DragEvent) => void;
    private dragLeaveListener?: (event: DragEvent) => void;
    private bodyDropListener?: (event: DragEvent) => void;
    private bodyDragOverListener?: (event: DragEvent) => void;
    private bodyDragEnterListener?: (event: DragEvent) => void;
    private bodyDragLeaveListener?: (event: DragEvent) => void;

    private dragElementStylesInterval?: ReturnType<typeof setInterval>;

    constructor(video: HTMLMediaElement) {
        this.video = video;
        this.imageElement = new ImageElement(video);
        this.bound = false;
    }

    bind(context: Binding) {
        if (this.bound) {
            return;
        }

        this.dropListener = (e: DragEvent) => {
            e.preventDefault();

            this.dragEnterElement = null;
            this.imageElement.element().classList.add('asbplayer-hide');
            this.imageElement.element().classList.remove('asbplayer-image-fade-in');
            this._dragElement().classList.remove('asbplayer-drag-zone-dragging');
            this._dragElement().classList.add('asbplayer-hide');

            if (!e.dataTransfer?.files || e.dataTransfer?.files.length === 0) {
                return;
            }

            const files = [];

            for (let i = 0; i < e.dataTransfer.files.length; ++i) {
                const f = e.dataTransfer.files[i];
                const extensionStartIndex = f.name.lastIndexOf('.');

                if (extensionStartIndex === -1) {
                    return false;
                }

                const extension = f.name.substring(extensionStartIndex + 1, f.name.length);

                if (
                    extension === 'ass' ||
                    extension === 'srt' ||
                    extension === 'vtt' ||
                    extension === 'sup' ||
                    extension === 'dfxp' ||
                    extension === 'ttml2'
                ) {
                    files.push(f);
                }
            }

            void context.loadSubtitles(files, false);
        };

        this.dragOverListener = (e) => e.preventDefault();

        this.dragEnterListener = (e) => {
            e.preventDefault();

            this.dragEnterElement = e.target;
            this.imageElement.element().classList.add('asbplayer-drag-image');
            this.imageElement.element().classList.remove('asbplayer-hide');
            this.imageElement.element().classList.add('asbplayer-image-fade-in');
        };

        this.dragLeaveListener = (e) => {
            e.preventDefault();

            if (this.dragEnterElement === e.target) {
                this.imageElement.element().classList.add('asbplayer-hide');
                this.imageElement.element().classList.remove('asbplayer-image-fade-in');
                this._dragElement().classList.remove('asbplayer-drag-zone-dragging');
                this._dragElement().classList.add('asbplayer-hide');
            }
        };

        this.bodyDropListener = (e) => {
            e.preventDefault();
            this.imageElement.element().classList.add('asbplayer-hide');
            this.imageElement.element().classList.remove('asbplayer-image-fade-in');
            this._dragElement().classList.remove('asbplayer-drag-zone-dragging');
            this._dragElement().classList.add('asbplayer-hide');
        };

        this.bodyDragOverListener = (e) => e.preventDefault();

        this.bodyDragEnterListener = (e) => {
            e.preventDefault();
            this.bodyDragEnterElement = e.target;
            this._dragElement().classList.add('asbplayer-drag-zone-dragging');
            this._dragElement().classList.remove('asbplayer-hide');
        };

        this.bodyDragLeaveListener = (e) => {
            e.preventDefault();

            if (this.bodyDragEnterElement === e.target) {
                this.imageElement.element().classList.add('asbplayer-hide');
                this.imageElement.element().classList.remove('asbplayer-image-fade-in');
                this._dragElement().classList.remove('asbplayer-drag-zone-dragging');
                this._dragElement().classList.add('asbplayer-hide');
            }
        };

        const dragElement = this._dragElement();

        dragElement.addEventListener('drop', this.dropListener);
        dragElement.addEventListener('dragover', this.dragOverListener);
        dragElement.addEventListener('dragenter', this.dragEnterListener);
        dragElement.addEventListener('dragleave', this.dragLeaveListener);
        document.body.addEventListener('drop', this.bodyDropListener);
        document.body.addEventListener('dragover', this.bodyDragOverListener);
        document.body.addEventListener('dragenter', this.bodyDragEnterListener);
        document.body.addEventListener('dragleave', this.bodyDragLeaveListener);

        this.bound = true;
    }

    _dragElement() {
        if (this.dragElement) {
            return this.dragElement;
        }

        const dragElement = document.createElement('div');
        dragElement.classList.add('asbplayer-drag-zone-initial');
        this.dragElement = dragElement;
        this._applyDragElementStyles(dragElement);

        document.body.appendChild(dragElement);

        this.dragElementStylesInterval = setInterval(() => this._applyDragElementStyles(dragElement), 1000);

        return this.dragElement;
    }

    _applyDragElementStyles(dragElement: HTMLDivElement) {
        const rect = this.video.getBoundingClientRect();

        // Shrink the drag zone slightly to avoid accidentally overflowing
        // e.g. when the video's rect changes for some reason

        dragElement.style.top = rect.top + window.scrollY + rect.height * 0.05 + 'px';
        dragElement.style.left = rect.left + rect.width * 0.05 + 'px';
        dragElement.style.height = Math.min(window.innerHeight, rect.height) * 0.9 + 'px';
        dragElement.style.width = Math.min(window.innerWidth, rect.width) * 0.9 + 'px';
    }

    unbind() {
        if (this.dropListener) {
            this.dragElement?.removeEventListener('drop', this.dropListener, true);
            this.dropListener = undefined;
        }

        if (this.dragOverListener) {
            this.dragElement?.removeEventListener('dragover', this.dragOverListener, true);
            this.dragOverListener = undefined;
        }

        if (this.dragEnterListener) {
            this.dragElement?.removeEventListener('dragenter', this.dragEnterListener, true);
            this.dragEnterListener = undefined;
        }

        if (this.dragLeaveListener) {
            this.dragElement?.removeEventListener('dragleave', this.dragLeaveListener, true);
            this.dragLeaveListener = undefined;
        }

        if (this.bodyDropListener) {
            document.body.removeEventListener('drop', this.bodyDropListener);
            this.bodyDropListener = undefined;
        }

        if (this.bodyDragOverListener) {
            document.body.removeEventListener('dragover', this.bodyDragOverListener);
            this.bodyDragOverListener = undefined;
        }

        if (this.bodyDragEnterListener) {
            document.body.removeEventListener('dragenter', this.bodyDragEnterListener);
            this.bodyDragEnterListener = undefined;
        }

        if (this.bodyDragLeaveListener) {
            document.body.removeEventListener('dragleave', this.bodyDragLeaveListener);
            this.bodyDragLeaveListener = undefined;
        }

        if (this.dragElementStylesInterval) {
            clearInterval(this.dragElementStylesInterval);
            this.dragElementStylesInterval = undefined;
        }

        if (this.dragElement) {
            this.dragElement.remove();
            this.dragElement = undefined;
        }

        this.imageElement.remove();
        this.dragEnterElement = null;
        this.bound = false;
    }
}
