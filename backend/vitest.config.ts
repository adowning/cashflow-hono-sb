import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'drizzle/**',
      '.git/**',
      '.cache/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'text-summary',
        'html',
        'lcov',
        'json',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        'drizzle/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        'src/server.ts',
        'src/app.ts',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 90,
          statements: 90,
        },
        'src/modules/gameplay/jackpot.service.ts': {
          branches: 90,
          functions: 90,
          lines: 95,
          statements: 95,
        },
      },
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown hooks
    teardownTimeout: 5000, // 5 seconds for teardown
    maxConcurrency: 5, // Limit concurrent tests to avoid overwhelming database
  },
  resolve: {
    alias: {
      '@': '/home/ash/Documents/hono-sb-nuxtdash/backend/src',
    },
  },
});
