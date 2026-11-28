export const ASB_TOKEN_CLASS = 'asb-token';
export const ASB_TOKEN_ADAPTIVE_HIDDEN_CLASS = 'asb-token-adaptive-hidden';
export const ASB_PLAYBACK_PAUSED_CLASS = 'asb-playback-paused';
export const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
export const ASB_TOKEN_HOVER_CLASS = 'asb-token-hover';
export const ASB_TOKEN_HOVER_CUE_CLASS = 'asb-token-hover-cue';
export const ASB_TOKEN_HOVER_WORD_CLASS = 'asb-token-hover-word';
export const ASB_TOKEN_BASE_CLASS = 'asb-token-base';
export const ASB_TOKEN_ON_CUE_HOVER_CLASS = 'asb-token-on-cue-hover';
export const ASB_TOKEN_ON_WORD_HOVER_CLASS = 'asb-token-on-word-hover';
export const ASB_TOKEN_SELECTED_CLASS = 'asb-token-selected';
export const ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS = 'asb-token-auto-pause-selected';
export const ASB_TOKEN_NATIVE_SELECTION_CLASS = 'asb-token-native-selection';
export const ASB_SUBTITLE_TOKEN_SELECTED_CLASS = 'asb-subtitle-token-selected';
export const ASB_SUBTITLE_INDEX_ATTRIBUTE = 'data-asb-subtitle-index';
export const ASB_TOKEN_START_ATTRIBUTE = 'data-asb-token-start';
export const ASB_READING_CLASS = 'asb-reading';
export const ASB_FREQUENCY_CLASS = 'asb-frequency';
export const ASB_GLOSS_CLASS = 'asb-gloss';
export const ASB_GLOSS_POPUP_CLASS = 'asb-gloss-popup';
export const ASB_GLOSS_TEXT_CLASS = 'asb-gloss-text';
export const ASB_GLOSS_UNDER_CLASS = 'asb-gloss-under';
export const ASB_PITCH_ACCENT_CLASS = 'asb-pitch-accent';
export const ASB_PITCH_ACCENT_MORA_CLASS = 'asb-pitch-accent-mora';
export const ASB_PITCH_ACCENT_MORA_HIGH_CLASS = 'asb-pitch-accent-mora-high';
export const ASB_PITCH_ACCENT_MORA_LOW_CLASS = 'asb-pitch-accent-mora-low';
export const ASB_PITCH_ACCENT_LINE_CLASS = 'asb-pitch-accent-line';
export const ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS = 'asb-subtitles-container-bottom';
export const ASB_SUBTITLE_CONTAINER_TOP_CLASS = 'asb-subtitles-container-top';
export const ASB_TOKEN_CONTAINER_CLASS = 'asb-token-container';
export const ASB_OVERLAY_DOCUMENT_FOCUSED_CLASS = 'asb-overlay-document-focused';

export const hoverWordSelector = `.${ASB_TOKEN_HOVER_CLASS}`;

export const elementForNode = (node: Node | null): Element | null => {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
};
