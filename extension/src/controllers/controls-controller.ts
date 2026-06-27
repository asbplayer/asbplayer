interface Point {
    x: number;
    y: number;
}

export default class ControlsController {
    private readonly video: HTMLMediaElement;
    private elements: Element[];

    constructor(video: HTMLMediaElement) {
        this.video = video;
        this.elements = [];
    }

    show() {
        for (const e of this.elements) {
            e.classList.remove('asbplayer-hide');
        }
    }

    hide() {
        this._garbageCollectElements();
        this._findElements();

        for (const e of this.elements) {
            e.classList.add('asbplayer-hide');
        }

        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(undefined), 0);
        });
    }

    _garbageCollectElements() {
        this.elements = this.elements.filter((e) => this.video.getRootNode().contains(e));
    }

    _findElements() {
        const rootNode = this.video.getRootNode() as Node & DocumentOrShadowRoot;

        if (typeof rootNode.elementFromPoint !== 'function') {
            return;
        }

        for (const p of this._samplePoints()) {
            for (const element of this._path(rootNode.elementFromPoint(p.x, p.y), rootNode)) {
                if (
                    element &&
                    !this._contains(this.elements, element) &&
                    !element.classList.contains('asbplayer-ui-frame')
                ) {
                    this.elements.push(element);
                }
            }
        }
    }

    *_samplePoints() {
        const rect = this.video.getBoundingClientRect();
        const stepX = rect.width / 12;
        const stepY = rect.height / 12;
        const maxX = rect.width + rect.x;
        const maxY = rect.height + rect.y;

        for (let x = rect.x; x <= maxX; x += stepX) {
            for (let y = rect.y; y <= maxY; y += stepY) {
                const point: Point = {
                    x: this._withNoise(x, stepX / 2, rect.x, maxX),
                    y: this._withNoise(y, stepY / 2, rect.y, maxY),
                };

                yield point;
            }
        }
    }

    _withNoise(center: number, radius: number, min: number, max: number) {
        return Math.min(max, Math.max(min, center + (Math.random() * radius * 2 - radius)));
    }

    *_path(element: Element | null, rootNode: Node & DocumentOrShadowRoot) {
        if (!element || element.contains(this.video)) {
            return;
        }

        if (rootNode instanceof ShadowRoot && !rootNode.contains(element)) {
            return;
        }

        const host: Element | undefined = (rootNode as ShadowRoot).host;

        let current = element;
        yield current;

        while (true) {
            const parent = current.parentElement;

            if (
                !parent ||
                parent.contains(this.video) ||
                (host !== undefined && (parent.contains(host) || parent.isSameNode(host)))
            ) {
                break;
            }

            current = parent;
            yield current;
        }
    }

    _contains(elements: Element[], element: Element) {
        for (const e of elements) {
            if (e.isSameNode(element)) {
                return true;
            }
        }

        return false;
    }
}
