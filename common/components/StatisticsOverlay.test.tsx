import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import StatisticsOverlay from '@project/common/components/StatisticsOverlay';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
import { defaultSettings, TokenStatus } from '@project/common/settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

it('finishes a failed source after processing its received cues, retaining the partial statistics', async () => {
    let receiveSnapshot: (snapshot?: DictionaryStatisticsSnapshot) => void = () => {};
    const storage = {
        onStatisticsSnapshot: (callback: typeof receiveSnapshot) => {
            receiveSnapshot = callback;
            return () => {};
        },
        requestStatisticsSnapshot: async () => {},
    };
    const dictionaryProvider = new DictionaryProvider(storage as ConstructorParameters<typeof DictionaryProvider>[0]);
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } });
    await act(async () =>
        root.render(
            <I18nextProvider i18n={i18n}>
                <StatisticsOverlay
                    dictionaryProvider={dictionaryProvider}
                    open
                    onOpenStatistics={() => {}}
                    onReceivedSnapshot={() => {}}
                    onClose={() => {}}
                />
            </I18nextProvider>
        )
    );
    const snapshot: DictionaryStatisticsSnapshot = {
        mediaId: 'video',
        settings: { dictionaryTracks: defaultSettings.dictionaryTracks },
        anki: { cardsInfo: {}, dueCards: {} },
        snapshots: [
            {
                track: 0,
                sourceStatus: 'loading',
                progress: { current: 1, total: 2, startedAt: 0 },
                statusColors: {} as Record<TokenStatus, string>,
                stats: {
                    dictionary: { tokens: {} },
                    sentences: {
                        0: {
                            text: 'word',
                            start: 0,
                            end: 1000,
                            track: 0,
                            index: 0,
                            tokenization: {
                                tokens: [
                                    {
                                        pos: [0, 4],
                                        readings: [],
                                        states: [],
                                        status: TokenStatus.UNKNOWN,
                                        groupingKey: 'token:word',
                                        frequency: 1,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        ],
    };
    await act(async () => receiveSnapshot(snapshot));
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBeNull();

    snapshot.snapshots[0].sourceStatus = 'failed';
    await act(async () => receiveSnapshot({ ...snapshot }));
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50');

    snapshot.snapshots[0].progress.current = 2;
    await act(async () => receiveSnapshot({ ...snapshot }));
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).toContain('statistics.comprehension');
});
