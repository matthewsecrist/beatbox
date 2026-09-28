<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import Workspace from '$lib/Workspace.svelte'
  import { Eye, Heart } from '@lucide/svelte'

  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()
  const share = $derived(data.share)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
</script>

<section
  id="share-info"
  class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 shadow-lg shadow-black/40"
>
  <span>Shared by <strong id="share-owner" class="text-zinc-100">{share.owner}</strong></span>
  <span
    id="share-views"
    class="flex items-center gap-1.5 text-zinc-400"
    title="Visits by other people, once a day each"
  >
    <Eye class="size-4" />
    {plural(share.views, 'view')}
  </span>
  {#if share.editId}
    <span id="share-likes" class="flex items-center gap-1.5 text-zinc-400">
      <Heart class="size-4" />
      {plural(share.likes, 'like')}
    </span>
    <span class="text-zinc-500">This is your song as everyone with the link sees it.</span>
    <a
      id="edit-shared"
      href={resolve('/songs/[id]', { id: share.editId })}
      class="ml-auto rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-zinc-900 transition hover:bg-amber-300"
      >Edit it</a
    >
  {:else if data.signedIn}
    <form method="POST" action="?/like" use:enhance>
      <input type="hidden" name="liked" value={String(!share.liked)} />
      <button
        id="like"
        type="submit"
        aria-pressed={share.liked}
        aria-label={share.liked ? 'Unlike' : 'Like'}
        class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1 transition hover:border-pink-400/60 hover:text-pink-300 aria-pressed:border-pink-400/60 aria-pressed:bg-pink-400/10 aria-pressed:text-pink-300"
      >
        <Heart class={['size-4', share.liked && 'fill-current']} />
        {plural(share.likes, 'like')}
      </button>
    </form>
  {:else}
    <span id="share-likes" class="flex items-center gap-1.5 text-zinc-400">
      <Heart class="size-4" />
      {plural(share.likes, 'like')}
    </span>
    <!-- A GET form, so the login page gets `?next=` and comes back here after. -->
    <form method="GET" action={resolve('/login')}>
      <input type="hidden" name="next" value={share.path} />
      <button
        id="sign-in-to-like"
        type="submit"
        class="cursor-pointer text-amber-300 hover:underline">Sign in to like it</button
      >
    </form>
  {/if}
  {#if form && 'error' in form}
    <span role="alert" class="text-red-300">{form.error}</span>
  {/if}
</section>

{#key data.key}
  <Workspace {data} />
{/key}
