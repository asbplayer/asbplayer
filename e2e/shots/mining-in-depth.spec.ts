import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { test } from '../fixtures/extension';
import { loadSubtitlesOntoVideo } from '../scenarios/load-subtitles';
import { loadAndShowOverlay, mineButton } from '../scenarios/mine-subtitle';
import { CARD_DEFINITION, CARD_WORD, mineVideoFileInApp, waitForCopySnackbarToClear } from '../scenarios/mine-file-in-app';
import { DOCS_IMAGE_DIR, DOCS_MAP_FILE } from '../fixtures/paths';

const PANEL_VIEWPORT = { width: 400, height: 800 };

const image = (name: string) => path.join(DOCS_IMAGE_DIR, name);

type Box = { x: number; y: number; width: number; height: number };
type Region = { x: number; y: number; w: number; h: number };

async function paddedScreenshot(page: Page, boxes: (Box | null)[], padding: number, file: string) {
    const visible = boxes.filter((box): box is Box => box !== null);
    const left = Math.min(...visible.map((box) => box.x));
    const top = Math.min(...visible.map((box) => box.y));
    const right = Math.max(...visible.map((box) => box.x + box.width));
    const bottom = Math.max(...visible.map((box) => box.y + box.height));

    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const x = Math.max(0, Math.floor(left - padding));
    const y = Math.max(0, Math.floor(top - padding));
    const width = Math.min(viewport.width - x, Math.ceil(right - left + padding * 2));
    const height = Math.min(viewport.height - y, Math.ceil(bottom - top + padding * 2));

    await page.screenshot({ path: file, clip: { x, y, width, height }, animations: 'disabled' });
}

function union(boxes: (Box | null)[]): Box {
    const visible = boxes.filter((box): box is Box => box !== null);
    const left = Math.min(...visible.map((box) => box.x));
    const top = Math.min(...visible.map((box) => box.y));
    const right = Math.max(...visible.map((box) => box.x + box.width));
    const bottom = Math.max(...visible.map((box) => box.y + box.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

const boxesOf = (locators: Locator[]) => Promise.all(locators.map((locator) => locator.boundingBox()));

/** The field root: the input is inset and shorter, so measuring it clips the region. */
const fieldRoot = (input: Locator) =>
    input.locator('xpath=ancestor::div[contains(@class, "MuiFormControl-root")][1]');

const percent = (value: number, total: number) => Math.round((value / total) * 1000) / 10;

/** Page-space box to dialog percentages. */
function toRegion(box: Box, dialog: Box): Region {
    return {
        x: percent(box.x - dialog.x, dialog.width),
        y: percent(box.y - dialog.y, dialog.height),
        w: percent(box.width, dialog.width),
        h: percent(box.height, dialog.height),
    };
}

test('generates images for docs/guides/mining-in-depth', async ({ ext }) => {
    fs.mkdirSync(DOCS_IMAGE_DIR, { recursive: true });

    // 1. The Mine Subtitle button in the side panel's subtitle list, cropped to its row.
    {
        const { video, panel } = await loadSubtitlesOntoVideo(ext, { panelViewport: PANEL_VIEWPORT });
        await panel.emulateMedia({ colorScheme: 'dark' });

        // The panel shows the player (with the subtitle list) while the video plays.
        await video.evaluate(() => {
            const element = document.querySelector('video');
            if (element) void element.play();
        });

        const mine = panel.getByRole('button', { name: 'Mine Subtitle', exact: true }).first();
        await mine.waitFor({ state: 'visible', timeout: 15_000 });
        await mine.hover();

        const row = mine.locator('xpath=ancestor::tr');
        await paddedScreenshot(panel, [await row.boundingBox()], 12, image('panel-subtitle-list.png'));
    }

    // 2. The Mine Subtitle button in the overlay UI, cropped to the overlay and its tooltip.
    {
        const { video, overlay } = await loadAndShowOverlay(ext);
        await video.emulateMedia({ colorScheme: 'dark' });

        await mineButton(overlay).hover();
        const tooltip = overlay.getByText('Mine', { exact: true });
        await expect(tooltip).toBeVisible({ timeout: 5_000 });

        const overlayBox = await video.locator('iframe.asbplayer-mobile-video-overlay-frame').boundingBox();
        const tooltipBox = await tooltip.boundingBox();
        await paddedScreenshot(video, [overlayBox, tooltipBox], 12, image('overlay-mine-button.png'));
    }

    // 3. The Anki export dialog plus an image map of its adjustable parts. The regions are
    //    measured from the same dialog that is captured, so links can't drift from the image.
    {
        const { page, dialog } = await mineVideoFileInApp(ext);
        await page.emulateMedia({ colorScheme: 'dark' });
        await dialog.getByRole('textbox', { name: 'Definition' }).fill(CARD_DEFINITION);
        await dialog.getByRole('textbox', { name: 'Word' }).fill(CARD_WORD);
        await waitForCopySnackbarToClear(page);

        const dialogBox = await dialog.boundingBox();
        if (dialogBox === null) throw new Error('Anki dialog has no bounding box');

        const textFields = union(
            await boxesOf([
                fieldRoot(dialog.getByRole('textbox', { name: 'Sentence' }).first()),
                fieldRoot(dialog.getByRole('textbox', { name: 'Definition' }).first()),
                fieldRoot(dialog.getByRole('textbox', { name: 'Word' }).first()),
            ])
        );
        const audioField = union(await boxesOf([fieldRoot(dialog.getByRole('textbox', { name: 'Audio' }).first())]));
        const imageField = union(await boxesOf([fieldRoot(dialog.getByRole('textbox', { name: 'Image' }).first())]));

        // A range slider's thumbs don't span its track, so the row uses the dialog's content width.
        const thumbs = union(await boxesOf(await dialog.getByRole('slider').all()));
        const timeRange = {
            x: dialogBox.x + 36,
            y: thumbs.y - 24,
            width: dialogBox.width - 72,
            height: thumbs.height + 48,
        };

        await dialog.screenshot({ path: image('anki-dialog-map.png'), animations: 'disabled' });

        fs.mkdirSync(path.dirname(DOCS_MAP_FILE), { recursive: true });
        fs.writeFileSync(
            DOCS_MAP_FILE,
            `${JSON.stringify(
                {
                    width: Math.round(dialogBox.width),
                    height: Math.round(dialogBox.height),
                    regions: {
                        'text-fields': toRegion(textFields, dialogBox),
                        'audio-field': toRegion(audioField, dialogBox),
                        'image-field': toRegion(imageField, dialogBox),
                        'selected-time-range': toRegion(timeRange, dialogBox),
                    },
                },
                null,
                4
            )}\n`
        );
    }
});
