import type { PlausibleEventOptions } from '@plausible-analytics/tracker';

declare global {
    interface Window {
        plausible?: (eventName: string, options?: PlausibleEventOptions) => void;
    }
}
