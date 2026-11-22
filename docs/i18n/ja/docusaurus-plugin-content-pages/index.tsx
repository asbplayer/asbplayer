import project from '../../../../project.json';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import HeroSubtitleStream from '../../../src/components/HeroSubtitleStream';
import HeroLogo from '../../../src/components/HeroLogo';
import styles from '../../../src/pages/index.module.css';

const ChromeIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.pillIcon} fill="currentColor">
        <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
    </svg>
);

const FirefoxIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.pillIcon} fill="currentColor">
        <path d="M8.824 7.287c.008 0 .004 0 0 0zm-2.8-1.4c.006 0 .003 0 0 0zm16.754 2.161c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 01-.13-.24 2.118 2.118 0 01-.172-.46.03.03 0 00-.027-.03.038.038 0 00-.021 0l-.006.001a.037.037 0 00-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 00-2.305.587.297.297 0 00-.147.37c.057.162.24.24.396.17a5.622 5.622 0 012.008-.523l.067-.005a5.847 5.847 0 011.957.222l.095.03a5.816 5.816 0 01.616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 01.368.211 5.953 5.953 0 012.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 01-1.513-.292 4.42 4.42 0 01-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 00-.301-.227 5.388 5.388 0 01-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 00-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 00-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844z" />
    </svg>
);

const WebAppIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 28 28" className={styles.pillIconLogo}>
        <path
            fill="currentColor"
            d="M 0 0 L 0 20 L 4 21 A 1 1 0 0 0 8 21 L 8 6 A 1 1 0 0 0 4 6 L 4 21 L 0 20 L 0 0 L 12 0 L 12 23 L 22 23 A 1 1 0 0 0 22 19 L 16 19 L 16 6 A 1 1 0 0 0 12 6 L 12 0 L 20 0 L 20 13 A 1 1 0 0 0 24 13 L 24 6 A 1 1 0 0 0 20 6 L 20 0"
        />
    </svg>
);

const GuideIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.pillIcon} fill="currentColor">
        <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
    </svg>
);

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext();
    return (
        <header className={clsx('hero', styles.heroBanner)}>
            <div className="container">
                {/* The logo and subtitle stream are the hero. These hidden
                    copies keep the name and tagline for screen readers and
                    crawlers. */}
                <Heading as="h1" className={styles.srOnly}>
                    {siteConfig.title}
                </Heading>
                <p className={styles.srOnly}>字幕で語学を学ぶ</p>
                <HeroLogo />
                <HeroSubtitleStream />

                <div className={styles.linksSection}>
                    <p className={styles.linksHint}>
                        ストリーミング動画には拡張機能をインストールし、動画ファイルにはウェブアプリを使用してください。
                    </p>
                    <div className={styles.pillRow}>
                        <a
                            className={styles.pillButton}
                            href={project.extension.chrome.storeUrl}
                            target="_blank"
                        >
                            <ChromeIcon />
                            Chrome
                        </a>
                        <a
                            className={styles.pillButton}
                            href={project.extension.firefox.storeUrl}
                            target="_blank"
                        >
                            <FirefoxIcon />
                            Firefox
                        </a>
                        <a className={styles.pillButton} href={project.urls.app} target="_blank">
                            <WebAppIcon />
                            ウェブアプリ
                        </a>
                        <Link className={styles.pillButton} to="/docs/intro">
                            <GuideIcon />
                            ユーザーガイド
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout title={`${project.names.short} docs`} description={siteConfig.tagline}>
            <HomepageHeader />
            <main className="container">
                <div className={clsx('row', styles.featureSection)}>
                    <div className="col col--7">
                        <h1>
                            ほぼすべての動画ソースに<span className={styles.textSelectable}>テキスト選択可能な</span>字幕を追加
                        </h1>
                        <p>
                            ストリーミング動画を含むほぼすべての動画ソースに、テキスト選択可能な字幕を追加できます。手持ちの字幕を使うか、25以上の対応ウェブサイトで自動検出された字幕を使うか、約85%のウェブサイトで動作する汎用字幕検出をお試しください。
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
                        <h1>マルチメディアAnkiカードを作成</h1>
                        <p>
                            字幕と動画ソースを組み合わせて、画像と音声付きの高品質なマルチメディア語彙カードを作成できます。
                        </p>
                    </div>
                </div>
                <div className={clsx('row', styles.featureSection)}>
                    <div className="col col--7">
                        <h1>語学学習の進捗を分析・記録</h1>
                        <p>
                            Combine asbplayer with{' '}
                            <a href="https://yomitan.wiki/" target="_blank">
                                Yomitan
                            </a>{' '}
                            と組み合わせると、字幕を分析し、既知の語彙を記録する強力な単語注釈機能を利用できます。
                        </p>
                    </div>
                    <div className="col col--5">
                        <video autoPlay loop muted playsInline className={styles.video} src="/video/asbplayer-3.mp4" />
                    </div>
                </div>
                <div className={clsx('row', styles.ctaSection)}>
                    <div className="col col--12 text--center">
                        <h1>語学学習者による、語学学習者のための</h1>
                        <p>
                            asbplayerは無料のオープンソースプロジェクトで、コミュニティによって運営され、何千人もの語学学習者に利用されています。
                        </p>
                        <div className={styles.ctaButtons}>
                            <Link className="button button--secondary button--lg" to="/docs/intro">
                                詳しく見る
                            </Link>
                            <Link className={clsx('button', 'button--lg', styles.discordButton)} to={project.urls.discord}>
                                <span className={styles.discordIcon} aria-hidden="true" />
                                Discordに参加
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </Layout>
    );
}
