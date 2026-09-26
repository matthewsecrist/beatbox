import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    env: { DATABASE_URL: ':memory:' },
    environment: 'node',
    expect: { requireAssertions: true },
    include: ['src/**/*.{test,spec}.ts']
  }
})
