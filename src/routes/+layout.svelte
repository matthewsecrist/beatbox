<script lang="ts">
  import type { Snippet } from 'svelte'

  import { resolve } from '$app/paths'
  import { env } from '$env/dynamic/public'
  import { GraduationCap, LogOut, Music, User } from '@lucide/svelte'
  import posthog from 'posthog-js'

  import type { LayoutData } from './$types'

  import '../app.css'

  let { children, data }: { children: Snippet; data: LayoutData } = $props()

  $effect(() => {
    if (!env.PUBLIC_POSTHOG_PROJECT_TOKEN || !env.PUBLIC_POSTHOG_HOST) return
    if (data.user) {
      posthog.identify(data.user.id, {
        email: data.user.email,
        username: data.user.username
      })
    } else if (posthog.get_property('$user_state') === 'identified') {
      posthog.reset()
    }
  })

  function handleSignOut() {
    posthog.capture('user_signed_out')
    posthog.reset()
  }
</script>

<header class="flex items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:px-8">
  <a href={resolve('/')} class="text-lg font-bold tracking-tight">Beatbox</a>
  <a
    id="learn-link"
    href={resolve('/learn')}
    class="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
  >
    <GraduationCap class="size-4" />
    Learn
  </a>
  {#if data.user}
    <a
      id="my-songs-link"
      href={resolve('/songs')}
      class="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
    >
      <Music class="size-4" />
      My songs
    </a>
    <span
      id="current-user"
      title={data.user.email}
      class="ml-auto flex min-w-0 items-center gap-1.5 text-sm text-zinc-400"
    >
      <User class="size-4 shrink-0" />
      <span class="truncate">{data.user.username}</span>
    </span>
    <form method="POST" action={resolve('/logout')} onsubmit={handleSignOut} class="shrink-0">
      <button
        id="sign-out"
        type="submit"
        class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <LogOut class="size-4" />
        <span class="max-sm:sr-only">Sign out</span>
      </button>
    </form>
  {/if}
</header>

<main class="px-2 pt-2 pb-8 sm:px-6 sm:py-8 lg:px-8">
  <div class="mx-auto max-w-5xl space-y-4 xl:max-w-none">
    {@render children()}
  </div>
</main>
