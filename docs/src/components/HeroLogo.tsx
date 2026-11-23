import type { ReactNode } from 'react';
import styles from './HeroLogo.module.css';

// Inline copy of the app's LogoIcon (common/components/LogoIcon.tsx):
// gradient background, white glyph path. Duplicated here so the docs hero
// can show the brand mark without pulling MUI into the docs bundle.
export default function HeroLogo(): ReactNode {
    return (
        <div className={styles.wrapper} aria-hidden="true">
            <div className={styles.glass} />
            <svg className={styles.logo} viewBox="0 0 28 28">
                <path
                    fill="white"
                    d="M 0 0 L 0 20 L 4 21 A 1 1 0 0 0 8 21 L 8 6 A 1 1 0 0 0 4 6 L 4 21 L 0 20 L 0 0 L 12 0 L 12 23 L 22 23 A 1 1 0 0 0 22 19 L 16 19 L 16 6 A 1 1 0 0 0 12 6 L 12 0 L 20 0 L 20 13 A 1 1 0 0 0 24 13 L 24 6 A 1 1 0 0 0 20 6 L 20 0"
                />
            </svg>
        </div>
    );
}
