import { defineConfig } from 'vite';

export default defineConfig({
    // Extension pages must reference their bundled assets relatively.
    base: './',
    build: {
        rollupOptions: {
            input: {
                popup: 'popup.html',
            },
        },
    },
});
