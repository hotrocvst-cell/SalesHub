import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Plugin tạo file 200.html cho Cloudflare Pages / Workers
 * Giúp Cloudflare nhận diện cơ chế Single Page Application (SPA) native
 * mà không cần file _redirects gây lỗi loop 100324
 */
function spaFallbackPlugin(): Plugin {
    return {
        name: 'spa-fallback-plugin',
        closeBundle() {
            const distPath = path.resolve(__dirname, 'dist');
            const indexPath = path.join(distPath, 'index.html');
            const fallbackPath = path.join(distPath, '200.html');
            if (fs.existsSync(indexPath)) {
                fs.copyFileSync(indexPath, fallbackPath);
            }
        }
    };
}

export default defineConfig({
    plugins: [react(), spaFallbackPlugin()],
    server: {
        port: 5173,
        host: true
    }
});