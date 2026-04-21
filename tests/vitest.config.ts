import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, 'unit/setup.ts')],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
})
