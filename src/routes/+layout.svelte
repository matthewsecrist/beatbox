<script lang="ts">
  import type { Snippet } from 'svelte'

  import { resolve } from '$app/paths'
  import { LogOut, User } from '@lucide/svelte'

  import type { LayoutData } from './$types'

  import '../app.css'

  let { children, data }: { children: Snippet; data: LayoutData } = $props()
</script>

<header class="flex items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
  <a href={resolve('/')} class="text-lg font-bold tracking-tight">Beatbox</a>
  {#if data.user}
    <span
      id="current-user"
      title={data.user.email}
      class="ml-auto flex items-center gap-1.5 text-sm text-zinc-400"
    >
      <User class="size-4" />
      {data.user.username}
    </span>
    <form method="POST" action={resolve('/logout')}>
      <button
        id="sign-out"
        type="submit"
        class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <LogOut class="size-4" />
        Sign out
      </button>
    </form>
  {/if}
</header>

<main class="px-4 py-8 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-5xl space-y-4 xl:max-w-none">
    {@render children()}
  </div>
</main>
