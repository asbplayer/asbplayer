import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { test } from '../fixtures/extension';
import {
    CARD_DEFINITION,
    CARD_WORD,
    mineFirstSubtitleInApp,
    openVideoInApp,
    waitForCopySnackbarToClear,
} from '../scenarios/mine-file-in-app';
import { DOCS_IMAGE_DIR, FIRST_SUBTITLE } from '../fixtures/paths';

const image = (name: string) => path.join(DOCS_IMAGE_DIR, name);
const CARD_URL = 'http://localhost:8931/anki-card.html';

// Loading, settling, theater mode, and mining exceed the default timeout.
test.setTimeout(120_000);

test('generates images for docs/getting-started/mining-subtitles', async ({ ext }) => {
    fs.mkdirSync(DOCS_IMAGE_DIR, { recursive: true });

    // The web app is used for both shots: its subtitle list resembles the side panel, and
    // mining a video file captures mined media without the extension's activeTab grant.
    const app = await openVideoInApp(ext);
    await app.page.emulateMedia({ colorScheme: 'dark' });

    // 1. The app in theater mode with the mine button on the first subtitle row hovered
    //    (docs step 2).
    await app.mineButton.hover();
    await app.page.screenshot({ path: image('mining-player.png'), animations: 'disabled' });

    // 2. The Anki export dialog with the mined sentence, image thumbnail, and audio field
    //    (docs step 3). The copy notification is dismissed first so it doesn't cover it.
    const dialog = await mineFirstSubtitleInApp(app);
    await waitForCopySnackbarToClear(app.page);
    await dialog.getByRole('textbox', { name: 'Definition' }).fill(CARD_DEFINITION);
    await dialog.getByRole('textbox', { name: 'Word' }).fill(CARD_WORD);
    await expect(dialog.getByRole('textbox', { name: 'Sentence' })).toHaveValue(FIRST_SUBTITLE);
    await dialog.screenshot({ path: image('mining-dialog.png'), animations: 'disabled' });

    // 3. A preview of the resulting Anki card, rendered from the note type documented on
    //    this page, using the mined image.
    const minedImage = await dialog.locator('img').first().getAttribute('src');

    const card = await ext.context.newPage();
    await card.setViewportSize({ width: 900, height: 900 });
    await card.goto(CARD_URL);
    await card.evaluate(
        (values) => {
            document.getElementById('sentence')!.textContent = values.sentence;
            document.getElementById('definition')!.textContent = values.definition;

            const img = document.createElement('img');
            img.src = values.frame;
            document.getElementById('image')!.append(img);

            const audio = document.querySelector('#audio audio') as HTMLAudioElement;
            audio.src = values.audio;

            document.getElementById('source')!.textContent = values.source;
            document.getElementById('url')!.textContent = values.url;
        },
        {
            sentence: FIRST_SUBTITLE,
            definition: CARD_DEFINITION,
            frame: minedImage ?? '',
            audio: '/subtitles/mined-card.mp3',
            source: 'docs-video.srt',
            url: 'https://video.example.com/drinking-bird',
        }
    );
    await card.locator('#card').screenshot({ path: image('anki-card.png'), animations: 'disabled' });
    await card.close();
});
