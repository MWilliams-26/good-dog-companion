import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// In emulator mode the browser talks to the Firebase Emulator Suite through
// this server (same origin), so the app also works behind a private preview
// proxy where the emulator ports are not reachable directly.
const emulatorProxy = {
  '/google.firestore.v1.Firestore': { target: 'http://127.0.0.1:8080', ws: true },
  '/identitytoolkit.googleapis.com': 'http://127.0.0.1:9099',
  '/securetoken.googleapis.com': 'http://127.0.0.1:9099',
  '/emulator': 'http://127.0.0.1:9099',
  '/v0/b': 'http://127.0.0.1:9199',
};

// The public demo build (`--mode demo`) replaces the Firebase SDK with
// in-browser stand-ins (src/demo/firebase), so it needs no backend.
const demoAlias = [
  { find: /^firebase\/(app|auth|firestore|storage)$/, replacement: fileURLToPath(new URL('./src/demo/firebase/$1.ts', import.meta.url)) },
];

export default defineConfig(({ mode }) => ({
  resolve: { alias: mode === 'demo' ? demoAlias : [] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Good Dog Companion',
        short_name: 'Good Dog',
        description: 'Private practice companion for Good Dog Behavior Consultants.',
        theme_color: '#232C08',
        background_color: '#FBF8F1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/(google\.firestore|identitytoolkit|securetoken|emulator|v0)/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5173, proxy: emulatorProxy, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, proxy: emulatorProxy, allowedHosts: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
