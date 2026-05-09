export const createStatisticsPopup = () => {
    browser.windows.getLastFocused((window) => {
        browser.windows.create({
            type: 'popup',
            focused: true,
            width: window.width === undefined ? 800 : Math.floor(window.width / 2),
            height: window.height === undefined ? 800 : Math.floor((window.height * 3) / 4),
            url: browser.runtime.getURL('/statistics-ui.html'),
        });
    });
};
