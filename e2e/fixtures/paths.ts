import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const E2E_DIR = path.resolve(here, '..');
export const REPO_DIR = path.resolve(E2E_DIR, '..');
export const EXTENSION_DIR = path.join(REPO_DIR, 'extension/.output/chrome-mv3');
export const CLIENT_BUILD_DIR = path.join(REPO_DIR, 'client/dist');
export const DOCS_IMAGE_DIR = path.join(REPO_DIR, 'docs/static/img/generated');
export const DOCS_MAP_FILE = path.join(REPO_DIR, 'docs/src/generated/anki-dialog-map.json');
export const PUBLIC_DIR = path.join(E2E_DIR, 'pages/public');

// "The Engineering of the Drinking Bird" excerpt; see docs-video.LICENSE.txt.
export const DOCS_VIDEO_URL = 'http://localhost:8931/docs-video.html';
export const DOCS_VIDEO_FILE = path.join(PUBLIC_DIR, 'docs-video.mp4');
export const SUBTITLE_FILE = path.join(PUBLIC_DIR, 'docs-video.srt');

// The app build, served by the second static server.
export const APP_URL = 'http://localhost:8932/';

export const DOCS_VIDEO_DIR = path.join(REPO_DIR, 'docs/static/video/generated');

export const DEMO_VIDEO_DIR = path.join(E2E_DIR, 'demo-videos');

export const FIRST_SUBTITLE = 'This toy has fascinated me since childhood.';
export const SECOND_SUBTITLE = 'To me its motion is almost hypnotic.';
