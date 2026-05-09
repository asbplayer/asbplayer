import { SubtitleModel } from './model';

export default class AutoPauseContext {
    private lastStartedShowing?: SubtitleModel;
    private lastWillStopShowing?: SubtitleModel;

    onStartedShowing?: (subtitle: SubtitleModel) => void;
    onWillStopShowing?: (subtitle: SubtitleModel) => void;
    onNextToShow?: (subtitle: SubtitleModel) => void;

    willStopShowing(subtitle: SubtitleModel) {
        if (subtitle.end === this.lastWillStopShowing?.end) {
            return;
        }

        this.onWillStopShowing?.(subtitle);
        this.lastWillStopShowing = subtitle;
    }

    startedShowing(subtitle: SubtitleModel) {
        if (subtitle.start === this.lastStartedShowing?.start) {
            return;
        }

        this.onStartedShowing?.(subtitle);
        this.lastStartedShowing = subtitle;
    }

    clear() {
        this.lastStartedShowing = undefined;
        this.lastWillStopShowing = undefined;
    }
}
