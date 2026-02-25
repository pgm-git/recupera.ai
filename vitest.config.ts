import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['server.ts', 'express-app.ts', 'services/**/*.ts', 'lib/**/*.ts'],
      thresholds: {
        statements: 30,
      },
    },
  },
});
