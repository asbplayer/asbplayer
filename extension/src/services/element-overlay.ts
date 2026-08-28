import { OffscreenDomCache } from '@project/common';

export enum OffsetAnchor {
    bottom,
    top,
}

export interface KeyedHtml {
    key?: string;
    html: () => string;
}

export interface ElementOverlayParams {
    targetElement: HTMLElement;
    nonFullscreenContainerClassName: string;
    nonFullscreenContentClassName: string;
    fullscreenContainerClassName: string;
    fullscreenContentClassName: string;
    offsetAnchor: OffsetAnchor;
    contentPositionOffset?: number;
    contentWidthPercentage?: number;
    onContainerStyles?: (container: HTMLElement) => void;
    onMouseOver: (event: MouseEvent) => void;
    onMouseOut: (event: MouseEvent) => void;
}

export interface ElementOverlay {
    setHtml(htmls: KeyedHtml[]): void;
    appendHtml(html: string): void;
    refresh(): void;
    hide(): void;
    dispose(): void;
    nonFullscreenContainerClassName: string;
    nonFullscreenContentClassName: string;
    fullscreenContainerClassName: string;
    fullscreenContentClassName: string;
    offsetAnchor: OffsetAnchor;
    contentPositionOffset: number;
    contentWidthPercentage?: number;
    displayingElements: () => Iterable<HTMLElement>;
    containerElement: HTMLElement | undefined;
}

interface ApplyContainerStylesOptions {
    fullscreen: boolean;
}

export class CachingElementOverlay implements ElementOverlay {
    private readonly targetElement: HTMLElement;

    private readonly domCache: OffscreenDomCache = new OffscreenDomCache();

    private fullscreenContainerElement?: HTMLElement;
    private defaultContentElement?: HTMLElement;
    private nonFullscreenContainerElement?: HTMLElement;
    private nonFullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private nonFullscreenStylesInterval?: ReturnType<typeof setInterval>;
    private nonFullscreenElementFullscreenPollingInterval?: ReturnType<typeof setInterval>;
    private fullscreenElementFullscreenChangeListener?: (this: any, event: Event) => any;
    private fullscreenElementFullscreenPollingInterval?: ReturnType<typeof setInterval>;
    private fullscreenStylesInterval?: ReturnType<typeof setInterval>;
    private layoutAnimationFrame?: number;
    private onMouseOver: (event: MouseEvent) => void;
    private onMouseOut: (event: MouseEvent) => void;
    private onContainerStyles?: (container: HTMLElement) => void;

    nonFullscreenContainerClassName: string;
    nonFullscreenContentClassName: string;
    fullscreenContainerClassName: string;
    fullscreenContentClassName: string;
    offsetAnchor: OffsetAnchor = OffsetAnchor.bottom;
    contentPositionOffset: number;
    contentWidthPercentage?: number;

    constructor({
        targetElement,
        nonFullscreenContainerClassName,
        nonFullscreenContentClassName,
        fullscreenContainerClassName,
        fullscreenContentClassName,
        offsetAnchor,
        contentPositionOffset,
        contentWidthPercentage,
        onMouseOver,
        onMouseOut,
        onContainerStyles,
    }: ElementOverlayParams) {
        this.targetElement = targetElement;
        this.nonFullscreenContainerClassName = nonFullscreenContainerClassName;
        this.nonFullscreenContentClassName = nonFullscreenContentClassName;
        this.fullscreenContainerClassName = fullscreenContainerClassName;
        this.fullscreenContentClassName = fullscreenContentClassName;
        this.offsetAnchor = offsetAnchor;
        this.contentPositionOffset = contentPositionOffset ?? 75;
        this.contentWidthPercentage = contentWidthPercentage;
        this.onMouseOver = onMouseOver;
        this.onMouseOut = onMouseOut;
        this.onContainerStyles = onContainerStyles;

        // Necessary for token highlighting on hover
        document.body.classList.add('asbplayer-token-container');
        document.body.tabIndex = -1;
    }

    *displayingElements() {
        function* grandChildren(container: HTMLElement) {
            for (const content of container.childNodes) {
                for (const el of content.childNodes) {
                    if (el instanceof HTMLElement) {
                        yield el;
                    }
                }
            }
        }

        const container = this.containerElement;

        if (container !== undefined) {
            for (const el of grandChildren(container)) {
                yield el;
            }
        }
    }

    get containerElement() {
        if (document.fullscreenElement && this.fullscreenContainerElement !== undefined) {
            return this.fullscreenContainerElement;
        } else if (!document.fullscreenElement && this.nonFullscreenContainerElement !== undefined) {
            return this.nonFullscreenContainerElement;
        }

        return undefined;
    }

    uncacheHtml() {
        this.domCache.clear();
    }

    cacheHtml(key: string, html: string) {
        this.domCache.add(key, html);
    }

    hasCachedHtml(key: string) {
        return this.domCache.has(key);
    }

    removeCachedHtml(key: string) {
        this.domCache.delete(key);
    }

    cachedHtmlKeys() {
        return this.domCache.keys();
    }

    setHtml(htmls: KeyedHtml[]) {
        if (document.fullscreenElement) {
            this._displayFullscreenContentElementsWithHtml(htmls);
        } else {
            this._displayNonFullscreenContentElementsWithHtml(htmls);
        }
    }

    private _displayNonFullscreenContentElementsWithHtml(htmls: KeyedHtml[]) {
        this._displayNonFullscreenContentElements(htmls.map((html) => this._cachedContentElement(html.html, html.key)));
    }

    private _displayNonFullscreenContentElements(contentElements: HTMLElement[]) {
        for (const contentElement of contentElements) {
            contentElement.className = this.nonFullscreenContentClassName;
        }

        const container = this._nonFullscreenContainerElement();
        this._setChildren(container, contentElements);
        this._applyResponsiveContentStyles(container, this.targetElement.getBoundingClientRect().width);
    }

    private _displayFullscreenContentElementsWithHtml(htmls: KeyedHtml[]) {
        this._displayFullscreenContentElements(htmls.map((html) => this._cachedContentElement(html.html, html.key)));
    }

    private _displayFullscreenContentElements(contentElements: HTMLElement[]) {
        for (const contentElement of contentElements) {
            contentElement.className = this.fullscreenContentClassName;
        }

        const container = this._fullscreenContainerElement();
        this._setChildren(container, contentElements);
        this._applyResponsiveContentStyles(container, this.targetElement.getBoundingClientRect().width);
    }

    private _nonFullscreenContainerElement() {
        if (this.nonFullscreenContainerElement) {
            return this.nonFullscreenContainerElement;
        }

        const container = document.createElement('div');
        container.className = this.nonFullscreenContainerClassName;
        container.onmouseover = this.onMouseOver;
        container.onmouseout = this.onMouseOut;
        document.body.appendChild(container);
        this._applyContainerStyles(container, { fullscreen: false });

        const toggle = () => {
            if (document.fullscreenElement) {
                container.style.setProperty('display', 'none', 'important');
                this._transferChildren(container, this._fullscreenContainerElement(), this.fullscreenContentClassName);
                if (this.fullscreenContainerElement) {
                    this._refreshContainerStylesAfterLayout(this.fullscreenContainerElement, { fullscreen: true });
                }
            } else {
                container.style.display = '';

                if (this.fullscreenContainerElement) {
                    this._transferChildren(
                        this.fullscreenContainerElement,
                        container,
                        this.nonFullscreenContentClassName
                    );
                }
                this._refreshContainerStylesAfterLayout(container, { fullscreen: false });
            }
        };

        toggle();
        this.nonFullscreenElementFullscreenChangeListener = () => toggle();
        this.nonFullscreenStylesInterval = setInterval(
            () => this._applyContainerStyles(container, { fullscreen: false }),
            1000
        );
        this.nonFullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.nonFullscreenElementFullscreenChangeListener);
        this.nonFullscreenContainerElement = container;
        return container;
    }

    private _fullscreenContainerElement() {
        if (this.fullscreenContainerElement) {
            return this.fullscreenContainerElement;
        }

        const container = document.createElement('div');
        container.className = this.fullscreenContainerClassName;
        container.onmouseover = this.onMouseOver;
        container.onmouseout = this.onMouseOut;
        this._findFullscreenParentElement(container).appendChild(container);
        this._applyContainerStyles(container, { fullscreen: true });
        container.style.setProperty('display', 'none', 'important');

        const toggle = () => {
            if (document.fullscreenElement) {
                if (container.style.display === 'none' || this._fullscreenContainerParentIsStale(container)) {
                    container.style.display = '';
                    container.remove();
                    this._findFullscreenParentElement(container).appendChild(container);
                    this._refreshContainerStylesAfterLayout(container, { fullscreen: true });
                }

                if (this.nonFullscreenContainerElement) {
                    this._transferChildren(
                        this.nonFullscreenContainerElement,
                        container,
                        this.fullscreenContentClassName
                    );
                }
            } else if (!document.fullscreenElement) {
                container.style.setProperty('display', 'none', 'important');
                this._transferChildren(
                    container,
                    this._nonFullscreenContainerElement(),
                    this.nonFullscreenContentClassName
                );
                if (this.nonFullscreenContainerElement) {
                    this._refreshContainerStylesAfterLayout(this.nonFullscreenContainerElement, {
                        fullscreen: false,
                    });
                }
            }
        };

        toggle();
        this.fullscreenElementFullscreenChangeListener = () => toggle();
        this.fullscreenStylesInterval = setInterval(
            () => this._applyContainerStyles(container, { fullscreen: true }),
            1000
        );
        this.fullscreenElementFullscreenPollingInterval = setInterval(() => toggle(), 1000);
        document.addEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
        this.fullscreenContainerElement = container;
        return this.fullscreenContainerElement;
    }

    private _findFullscreenParentElement(container: HTMLElement): HTMLElement {
        const testNode = container.cloneNode(true) as HTMLElement;
        testNode.innerHTML = '&nbsp;'; // The node needs to take up some space to perform test clicks
        let current = this.targetElement.parentElement;

        if (!current) {
            return document.body;
        }

        const targetElementRootNode = this.targetElement.getRootNode();
        const rootNode: ShadowRoot | Document =
            targetElementRootNode instanceof ShadowRoot ? targetElementRootNode : document;

        let chosen: HTMLElement | undefined = undefined;

        do {
            const rect = current.getBoundingClientRect();

            if (
                rect.height > 0 &&
                (typeof chosen === 'undefined' ||
                    // Typescript is not smart enough to know that it's possible for 'chosen' to be defined here
                    rect.height >= (chosen as HTMLElement).getBoundingClientRect().height) &&
                this._clickable(rootNode, current, testNode)
            ) {
                chosen = current;
                break;
            }

            current = current.parentElement;
        } while (current && !current.isSameNode(document.body.parentElement));

        if (chosen) {
            return chosen;
        }

        return document.body;
    }

    private _transferChildren(source: HTMLElement, destination: HTMLElement, contentClassName: string) {
        if (!source || !destination) return;
        if (source === destination) return;

        while (source.firstChild) {
            if (source.firstChild instanceof HTMLDivElement) source.firstChild.className = contentClassName;
            destination.appendChild(source.firstChild);
        }
    }

    private _fullscreenContainerParentIsStale(container: HTMLElement) {
        const parent = container.parentElement;
        return !container.isConnected || parent === null || !parent.contains(this.targetElement);
    }

    private _setChildren(containerElement: HTMLElement, contentElements: HTMLElement[]) {
        while (containerElement.firstChild) {
            this.domCache.return(containerElement.lastChild! as HTMLElement);
        }

        for (const contentElement of contentElements) {
            containerElement.appendChild(contentElement);
        }
    }

    private _cachedContentElement(html: () => string, key: string | undefined) {
        if (key === undefined) {
            if (!this.defaultContentElement) {
                this.defaultContentElement = document.createElement('div');
            }

            this.defaultContentElement.innerHTML = html();
            return this.defaultContentElement;
        }

        return this.domCache.get(key, html);
    }

    appendHtml(html: string) {
        if (document.fullscreenElement) {
            this._appendHtml(`${html}\n`, this.fullscreenContentClassName, this._fullscreenContainerElement());
        } else {
            this._appendHtml(`${html}\n`, this.nonFullscreenContentClassName, this._nonFullscreenContainerElement());
        }
    }

    private _appendHtml(html: string, className: string, container: HTMLElement) {
        const breakLine = document.createElement('br');
        const content = document.createElement('div');
        content.innerHTML = html;
        content.className = className;
        container.appendChild(breakLine);
        container.appendChild(content);
    }

    refresh() {
        if (this.fullscreenContainerElement) {
            this._applyContainerStyles(this.fullscreenContainerElement, { fullscreen: true });
        }

        if (this.nonFullscreenContainerElement) {
            this._applyContainerStyles(this.nonFullscreenContainerElement, { fullscreen: false });
        }
    }

    hide() {
        if (this.nonFullscreenElementFullscreenChangeListener) {
            document.removeEventListener('fullscreenchange', this.nonFullscreenElementFullscreenChangeListener);
        }

        if (this.nonFullscreenStylesInterval) {
            clearInterval(this.nonFullscreenStylesInterval);
        }

        if (this.nonFullscreenElementFullscreenPollingInterval) {
            clearInterval(this.nonFullscreenElementFullscreenPollingInterval);
        }

        if (this.fullscreenElementFullscreenChangeListener) {
            document.removeEventListener('fullscreenchange', this.fullscreenElementFullscreenChangeListener);
        }

        if (this.fullscreenStylesInterval) {
            clearInterval(this.fullscreenStylesInterval);
        }

        if (this.fullscreenElementFullscreenPollingInterval) {
            clearInterval(this.fullscreenElementFullscreenPollingInterval);
        }

        if (this.layoutAnimationFrame !== undefined) {
            cancelAnimationFrame(this.layoutAnimationFrame);
            this.layoutAnimationFrame = undefined;
        }

        this.defaultContentElement?.remove();
        this.defaultContentElement = undefined;
        this.nonFullscreenContainerElement?.remove();
        this.nonFullscreenContainerElement = undefined;
        this.fullscreenContainerElement?.remove();
        this.fullscreenContainerElement = undefined;
    }

    private _refreshContainerStylesAfterLayout(container: HTMLElement, options: ApplyContainerStylesOptions) {
        this._applyContainerStyles(container, options);
        if (this.layoutAnimationFrame !== undefined) cancelAnimationFrame(this.layoutAnimationFrame);
        this.layoutAnimationFrame = requestAnimationFrame(() => {
            this.layoutAnimationFrame = undefined;
            if (container.isConnected) this._applyContainerStyles(container, options);
        });
    }

    private _applyContainerStyles(container: HTMLElement, { fullscreen }: ApplyContainerStylesOptions) {
        const rect = this.targetElement.getBoundingClientRect();
        if (
            !Number.isFinite(rect.left) ||
            !Number.isFinite(rect.top) ||
            !Number.isFinite(rect.width) ||
            !Number.isFinite(rect.height) ||
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            if (container.style.left === '' || container.style.top === '') {
                container.style.setProperty('visibility', 'hidden', 'important');
            }
            return;
        }

        container.style.removeProperty('visibility');

        let left = rect.left + rect.width / 2;
        let top =
            this.offsetAnchor === OffsetAnchor.bottom
                ? rect.top + rect.height - this.contentPositionOffset
                : rect.top + this.contentPositionOffset;

        const containingBlock =
            container.offsetParent instanceof HTMLElement
                ? container.offsetParent
                : fullscreen
                  ? container.parentElement
                  : null;
        if (containingBlock) {
            const containingBlockRect = containingBlock.getBoundingClientRect();
            left += containingBlock.scrollLeft - containingBlock.clientLeft - containingBlockRect.left;
            top += containingBlock.scrollTop - containingBlock.clientTop - containingBlockRect.top;
        } else {
            left += window.scrollX;
            top += window.scrollY;
        }

        container.style.left = left + 'px';
        this._applyResponsiveContentStyles(container, rect.width);

        if (this.contentWidthPercentage === -1) {
            container.style.maxWidth = rect.width + 'px';
            container.style.width = '';
        } else if (this.contentWidthPercentage !== undefined) {
            container.style.maxWidth = '';
            container.style.width =
                Math.min(window.innerWidth, (rect.width * this.contentWidthPercentage) / 100) + 'px';
        }

        container.style.top = top + 'px';
        container.style.bottom = '';

        this.onContainerStyles?.(container);
    }

    private _applyResponsiveContentStyles(container: HTMLElement, videoWidth: number) {
        for (const element of container.querySelectorAll<HTMLElement>('[data-asb-video-width-ratio]')) {
            const ratio = Number(element.dataset.asbVideoWidthRatio);
            if (Number.isFinite(ratio)) element.style.width = `${videoWidth * ratio}px`;
        }
    }

    private _clickable(rootNode: Document | ShadowRoot, container: HTMLElement, element: HTMLElement): boolean {
        container.appendChild(element);
        const rect = element.getBoundingClientRect();
        const clickedElement = rootNode.elementFromPoint(rect.x, rect.y);
        const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);
        element.remove();
        return clickable;
    }

    dispose() {
        this.hide();
        this.domCache.clear();
    }
}
