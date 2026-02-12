import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    server: {
        fs: {
            allow: [
                // Allow importing test fixtures and root package metadata.
                path.resolve(__dirname, '..'),
            ],
        },
    },
});
