const dragImageWidth = 300;
const dragImageHeight = 300;

export default class ImageElement {
    private readonly video: HTMLMediaElement;
    private imageElement?: HTMLDivElement;
    private imageElementStylesInterval?: ReturnType<typeof setInterval>;

    constructor(video: HTMLMediaElement) {
        this.video = video;
    }

    element() {
        if (this.imageElement) {
            return this.imageElement;
        }

        const container = document.createElement('div');
        container.classList.add('asbplayer-image-container');
        container.classList.add('asbplayer-hide');

        const image = document.createElement('img');
        image.classList.add('asbplayer-image');
        image.src = browser.runtime.getURL('/icon/image.png');

        this._applyImageContainerStyles(image, container);

        container.appendChild(image);
        document.body.appendChild(container);

        this.imageElementStylesInterval = setInterval(() => this._applyImageContainerStyles(image, container), 1000);
        this.imageElement = container;

        return this.imageElement;
    }

    _applyImageContainerStyles(image: HTMLImageElement, container: HTMLDivElement) {
        const rect = this.video.getBoundingClientRect();
        const containerWidth = Math.min(window.innerWidth, rect.width) * 0.9;
        const containerHeight = Math.min(window.innerHeight, rect.height) * 0.9;
        container.style.top = rect.top + window.scrollY + rect.height * 0.05 + 'px';
        container.style.left = rect.left + rect.width * 0.05 + 'px';
        container.style.width = containerWidth + 'px';
        container.style.height = containerHeight + 'px';

        const imageRatio = Math.min(1, Math.min(containerWidth / dragImageWidth, containerHeight / dragImageHeight));
        const imageWidth = dragImageWidth * imageRatio;
        const imageHeight = dragImageHeight * imageRatio;

        const topOffset = (containerHeight - imageHeight) / 2;
        const leftOffset = (containerWidth - imageWidth) / 2;
        image.style.top = topOffset + 'px';
        image.style.left = leftOffset + 'px';
        image.style.width = imageWidth + 'px';
        image.style.height = imageHeight + 'px';
    }

    remove() {
        if (this.imageElementStylesInterval) {
            clearInterval(this.imageElementStylesInterval);
            this.imageElementStylesInterval = undefined;
        }

        if (this.imageElement) {
            this.imageElement.remove();
            this.imageElement = undefined;
        }
    }
}
