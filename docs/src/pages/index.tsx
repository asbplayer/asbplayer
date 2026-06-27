import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

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
                    <div className={styles.linksSubsection}>
                        <div>Use asbplayer with streaming video</div>
                        <div className={styles.storeButtons}>
                            <a
                                href="https://chromewebstore.google.com/detail/asbplayer-language-learni/hkledmpjpaehamkiehglnbelcpdflcab"
                                target="_blank"
                            >
                                <img src="/img/chrome-web-store.png" alt="chrome-web-store-link" />
                            </a>
                            <a
                                href="https://addons.mozilla.org/firefox/addon/asbplayer-language-learning"
                                target="_blank"
                            >
                                <img src="/img/firefox-get-the-addon.webp" alt="firefox-addon-link" />
                            </a>
                        </div>
                    </div>

                    <div className={styles.linksSubsection}>
                        <div>Use asbplayer with video files</div>
                        <a href="https://app.asbplayer.dev" target="_blank">
                            <div className={styles.appLink}>
                                <img src="/img/app-logo.png" /> <span>Go to webapp</span>
                            </div>
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
                <div className="row margin--lg">
                    <div className="col col--7">
                        <h1>
                            Add <span className={styles.textSelectable}>text-selectable</span> subtitles to almost all
                            video sources
                        </h1>
                        <p>
                            Add text-selectable subtitles to almost all video sources, including streaming video. Bring
                            your own subtitles or use auto-detected subtitles on 20+ supported websites.
                        </p>
                        <p>Navigate between subtitles using keyboard shortcuts and a navigable subtitle list.</p>
                    </div>
                    <div className="col col--5">
                        <video autoPlay loop muted playsInline className={styles.video} src="/video/asbplayer-1.mp4" />
                    </div>
                </div>
                <div className="row margin--lg">
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
                <div className="row margin--lg">
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
                <div className="row margin--lg">
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
