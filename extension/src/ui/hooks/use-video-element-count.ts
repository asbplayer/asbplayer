import type { VideoTabModel } from '@project/common';
import type { ChromeExtension } from '@project/common/app';
import { useEffect, useState } from 'react';

export const useVideoElementCount = ({
    extension,
    currentTabId,
}: {
    extension: ChromeExtension;
    currentTabId?: number;
}) => {
    const [videoElementCount, setVideoElementCount] = useState<number>();

    useEffect(() => {
        if (currentTabId === undefined) {
            return;
        }

        const countInCurrentTab = (tabs: VideoTabModel[]) =>
            tabs.filter((t) => t.id === currentTabId && t.subscribed).length;

        if (extension.tabs !== undefined) {
            setVideoElementCount(countInCurrentTab(extension.tabs));
        }

        return extension.subscribeTabs((tabs) => {
            setVideoElementCount(countInCurrentTab(tabs));
        });
    }, [extension, currentTabId]);

    return videoElementCount;
};
