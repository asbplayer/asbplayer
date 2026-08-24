import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const ChromeIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className={styles.pillIcon} fill="currentColor">
        <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
    </svg>
);

const FirefoxIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className={styles.pillIcon} fill="currentColor">
        <path d="M8.824 7.287c.008 0 .004 0 0 0zm-2.8-1.4c.006 0 .003 0 0 0zm16.754 2.161c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 01-.13-.24 2.118 2.118 0 01-.172-.46.03.03 0 00-.027-.03.038.038 0 00-.021 0l-.006.001a.037.037 0 00-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 00-2.305.587.297.297 0 00-.147.37c.057.162.24.24.396.17a5.622 5.622 0 012.008-.523l.067-.005a5.847 5.847 0 011.957.222l.095.03a5.816 5.816 0 01.616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 01.368.211 5.953 5.953 0 012.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 01-1.513-.292 4.42 4.42 0 01-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 00-.301-.227 5.388 5.388 0 01-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 00-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 00-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844z" />
    </svg>
);

const WebAppIcon = () => (
    <svg role="img" viewBox="0 0 28 28" className={styles.pillIconLogo}>
        <path
            fill="currentColor"
            d="M 0 0 L 0 20 L 4 21 A 1 1 0 0 0 8 21 L 8 6 A 1 1 0 0 0 4 6 L 4 21 L 0 20 L 0 0 L 12 0 L 12 23 L 22 23 A 1 1 0 0 0 22 19 L 16 19 L 16 6 A 1 1 0 0 0 12 6 L 12 0 L 20 0 L 20 13 A 1 1 0 0 0 24 13 L 24 6 A 1 1 0 0 0 20 6 L 20 0"
        />
    </svg>
);

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext();
    return (
        <header className={clsx('hero', styles.heroBanner)}>
            <div className="container">
                <Heading as="h1" className={clsx(styles.heroTitle, 'hero__title')}>
                    {siteConfig.title}
                </Heading>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="/docs/intro">
                        User Guide
                    </Link>
                </div>

                <div className={styles.linksSection}>
                    <p className={styles.linksHint}>
                        Install the extension for streaming video, or use the web app for video files.
                    </p>
                    <div className={styles.pillRow}>
                        <a
                            className={styles.pillButton}
                            href="https://chromewebstore.google.com/detail/asbplayer-language-learni/hkledmpjpaehamkiehglnbelcpdflcab"
                            target="_blank"
                        >
                            <ChromeIcon />
                            Chrome
                        </a>
                        <a
                            className={styles.pillButton}
                            href="https://addons.mozilla.org/firefox/addon/asbplayer-language-learning"
                            target="_blank"
                        >
                            <FirefoxIcon />
                            Firefox
                        </a>
                        <a className={styles.pillButton} href="https://app.asbplayer.dev" target="_blank">
                            <WebAppIcon />
                            Web App
                        </a>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default function Home(): ReactNode {
    return (
        <Layout title={`asbplayer docs`} description="asbplayer docs">
            <HomepageHeader />
            <main className="container">
                <div className={clsx('row', styles.featureSection)}>
                    <div className="col col--7">
                        <h1>
                            Add <span className={styles.textSelectable}>text-selectable</span> subtitles to almost all
                            video sources
                        </h1>
                        <p>
                            Add text-selectable subtitles to almost all video sources, including streaming video. Bring
                            your own subtitles, use auto-detected subtitles on 20+ supported websites, or try
                            best-effort generic subtitle detection on other sites.
                        </p>
                    </div>
                    <div className="col col--5">
                        <video autoPlay loop muted playsInline className={styles.video} src="/video/asbplayer-1.mp4" />
                    </div>
                </div>
                <div className={clsx('row', styles.featureSection)}>
                    <div className="col col--5">
                        <video autoPlay loop muted playsInline className={styles.video} src="/video/asbplayer-2.mp4" />
                    </div>
                    <div className="col col--7">
                        <h1>Create multimedia Anki flashcards</h1>
                        <p>
                            Combine subtitles with video sources to create high-quality, multimedia vocabulary
                            flashcards with image and audio.
                        </p>
                    </div>
                </div>
                <div className={clsx('row', styles.featureSection)}>
                    <div className="col col--7">
                        <h1>Analyze and track your language-learning progress</h1>
                        <p>
                            Combine asbplayer with{' '}
                            <a href="https://yomitan.wiki/" target="_blank">
                                Yomitan
                            </a>{' '}
                            to unlock powerful word annotation features that analyze subtitles and keep track of your
                            known vocabulary.
                        </p>
                    </div>
                    <div className="col col--5">
                        <video autoPlay loop muted playsInline className={styles.video} src="/video/asbplayer-3.mp4" />
                    </div>
                </div>
                <div className={clsx('row', styles.ctaSection)}>
                    <div className="col col--12 text--center">
                        <h1>By language learners, for language learners</h1>
                        <p>
                            asbplayer is a free, open source, community-driven project, used by thousands of language
                            learners.
                        </p>
                        <Link className="button button--secondary button--lg" to="/docs/intro">
                            Learn more
                        </Link>
                    </div>
                </div>
            </main>
        </Layout>
    );
}
