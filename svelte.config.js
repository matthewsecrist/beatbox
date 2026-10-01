import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  kit: {
    adapter: adapter(),
    // Required for PostHog session replay to work correctly with SSR.
    paths: {
      relative: false
    },
    typescript: {
      // Type-check the Drizzle config with the rest of the app.
      config: (config) => {
        config.include.push('../drizzle.config.ts')
      }
    }
  },
  preprocess: vitePreprocess()
}
