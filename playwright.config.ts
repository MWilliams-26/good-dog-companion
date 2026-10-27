import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the Firebase emulators with the demo seed:
//   npm run emulators   (separate terminal)
//   npm run seed
//   npm run test:e2e
// With E2E_DEMO=1 (npm run test:e2e:demo) the same tests run against the
// backend-free demo build instead; each test's fresh browser gets a fresh demo.
const demo = !!process.env.E2E_DEMO;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  globalSetup: demo ? undefined : './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? (demo ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:5173'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['iPhone 14'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: demo
    ? {
        command: 'npm run build:demo && npx vite preview --mode demo --port 4174 --strictPort',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : {
        command: 'npx vite --port 5173 --strictPort',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
