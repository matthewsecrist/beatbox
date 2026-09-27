import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Provided by the Workers runtime (see src/lib/server/db/index.ts).
  build: { rolldownOptions: { external: ['cloudflare:workers'] } },
  plugins: [tailwindcss(), sveltekit()],
  test: {
    env: {
      BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      DATABASE_URL: ':memory:'
    },
    environment: 'node',
    expect: { requireAssertions: true },
    include: ['src/**/*.{test,spec}.ts']
  }
})
