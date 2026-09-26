<script lang="ts">
  import type { Snippet } from 'svelte'

  import { resolve } from '$app/paths'

  import '../app.css'

  let { children }: { children: Snippet } = $props()
</script>

<header class="flex items-center px-4 py-2 sm:px-6 lg:px-8">
  <a href={resolve('/')} class="text-lg font-bold tracking-tight">Beatbox</a>
</header>

<main class="px-4 py-8 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-5xl space-y-4">
    {@render children()}
  </div>
</main>
