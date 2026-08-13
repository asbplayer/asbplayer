import Binding from '@project/extension/src/services/binding';

interface Touch {
    x: number;
    timestamp: number;
}

const timeLimit = 500;
const minimumDistance = 50;

export class MobileGestureController {
    private readonly _context: Binding;
    private _bound = false;
    private _startTouch?: Touch;
    private _startTouchListener?: (event: TouchEvent) => void;
    private _endTouchListener?: (event: TouchEvent) => void;

    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;

    constructor(context: Binding) {
        this._context = context;
    }

    bind() {
        if (this._bound) {
            return;
        }

        this._startTouchListener = (event: TouchEvent) => {
            this._startTouch = { x: event.changedTouches[0].clientX, timestamp: Date.now() };
        };
        this._endTouchListener = (event: TouchEvent) => {
            if (!this._startTouch) {
                return;
            }

            const x = event.changedTouches[0].clientX;
            const y = event.changedTouches[0].clientY;

            if (this._insideRect(x, y) && Date.now() - this._startTouch.timestamp < timeLimit) {
                if (this._startTouch.x >= x + minimumDistance) {
                    this.onSwipeLeft?.();
                } else if (this._startTouch.x <= x - minimumDistance) {
                    this.onSwipeRight?.();
                }
            }

            this._startTouch = undefined;
        };
        document.addEventListener('touchstart', this._startTouchListener, true);
        document.addEventListener('touchend', this._endTouchListener, true);
        this._bound = true;
    }

    private _insideRect(x: number, y: number): boolean {
        const rect = this._context.video.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    unbind() {
        if (this._startTouchListener) {
            document.removeEventListener('touchstart', this._startTouchListener, true);
            this._startTouchListener = undefined;
        }

        if (this._endTouchListener) {
            document.removeEventListener('touchend', this._endTouchListener, true);
            this._endTouchListener = undefined;
        }

        this.onSwipeLeft = undefined;
        this.onSwipeRight = undefined;
        this._startTouch = undefined;
        this._bound = false;
    }
}
