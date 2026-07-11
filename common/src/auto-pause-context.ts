import { SubtitleModel } from './model';

export default class AutoPauseContext {
    private lastStartedShowing?: SubtitleModel;
    private lastWillStopShowing?: SubtitleModel;

    onStartedShowing?: (subtitle: SubtitleModel) => void;
    onWillStopShowing?: (subtitle: SubtitleModel) => Promise<void>;
    onNextToShow?: (subtitle: SubtitleModel) => void;

    async willStopShowing(subtitle: SubtitleModel): Promise<void> {
        if (subtitle.end === this.lastWillStopShowing?.end) {
            return;
        }

        this.lastWillStopShowing = subtitle;
        if (this.onWillStopShowing !== undefined) {
            await this.onWillStopShowing(subtitle);
        }
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
