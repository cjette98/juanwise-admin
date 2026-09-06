import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
// `vitest/config` re-exports vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/…` mirrors the alias juanwise-app-v2 uses, so a file moved between the
    // two projects keeps its imports.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5180 },
  test: {
    // Scoped to TypeScript so the repo's `node:test` .mjs files are left to
    // `node --test` rather than being collected as empty vitest suites.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
