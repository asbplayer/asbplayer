import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './HeroSubtitleStream.module.css';

const cueDurationMs = 3500;

const taglines: readonly string[] = [
    'Learn languages with subtitles', // en
    'Aprende idiomas con subtítulos', // es
    '字幕で言語を学ぼう', // ja
    'Lerne Sprachen mit Untertiteln', // de
    'Ucz się języków z napisami', // pl
    'Aprenda idiomas com legendas', // pt-BR
    '用字幕学习语言', // zh-CN
    'Учите языки с субтитрами', // ru
    'Opi kieliä tekstityksen avulla', // fi
    'Apprenez des langues avec des sous-titres', // fr
    '자막으로 언어를 배우세요', // ko
    'Pelajari bahasa dengan takarir', // id
    'Impara le lingue con i sottotitoli', // it
];

const cueCount = taglines.length;

// The middle copy is the one that scrolls. Three copies guarantee rows above
// and below the active cue for the spotlight to fade, and make the wrap from
// the last cue back to the first a seamless one-row slide instead of a
// visible jump.
const tripledTaglines = [...taglines, ...taglines, ...taglines];

// Spotlight falloff: each row's alpha relative to its distance from the
// active cue. Rows below the highlight decay steeply so they don't compete
// with the hero content. Rows above it pass behind the logo's frosted glass,
// so they can stay brighter. The blur does the de-emphasizing there.
const rowOpacity = (distance: number, behindLogo: boolean) => Math.pow(behindLogo ? 0.2 : 0.05, distance);

// Mirrors the app's timeDurationDisplay output for files under an hour.
const displayTime = (ms: number) => {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    const milliseconds = Math.floor(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

export default function HeroSubtitleStream(): ReactNode {
    const [pos, setPos] = useState(cueCount);
    const [snapping, setSnapping] = useState(false);
    const posRef = useRef(cueCount);

    useEffect(() => {
        // With reduced motion, keep the English cue as a static highlight.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        const id = window.setInterval(() => {
            if (posRef.current === 2 * cueCount) {
                // Row 2*cueCount shows the same content as row cueCount, so
                // resetting the scroll offset is invisible. Skip the transform
                // transition for this one update, or the reset animates.
                posRef.current = cueCount;
                setSnapping(true);
                setPos(cueCount);
            } else {
                posRef.current += 1;
                setSnapping(false);
                setPos(posRef.current);
            }
        }, cueDurationMs);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className={styles.viewport} aria-hidden="true">
            <div
                className={clsx(styles.column, snapping && styles.snapping)}
                style={{ transform: `translateY(calc(var(--hero-cue-height) * -${pos}))` }}
            >
                {tripledTaglines.map((text, index) => (
                    <div
                        key={index}
                        className={clsx(styles.row, index === pos && styles.activeRow)}
                        style={{ opacity: rowOpacity(Math.abs(index - pos), index < pos) }}
                    >
                        <span className={styles.text}>{text}</span>
                        <span className={styles.timestamp}>{displayTime((index % cueCount) * cueDurationMs)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
