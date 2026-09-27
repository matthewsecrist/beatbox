import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  kit: {
    adapter: adapter(),
    typescript: {
      // Type-check the Drizzle config with the rest of the app.
      config: (config) => {
        config.include.push('../drizzle.config.ts')
      }
    }
  },
  preprocess: vitePreprocess()
}
