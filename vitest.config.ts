import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The harness must be testable without Windows, without the kit and without a network.
    // Every test runs against the fake kit in test/kit/.
    pool: 'threads',
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
