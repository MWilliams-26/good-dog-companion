import { defineConfig } from 'vitest/config';

// Security-rule tests run against the Firebase emulators (see package.json test:rules).
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    fileParallelism: false,
  },
});
