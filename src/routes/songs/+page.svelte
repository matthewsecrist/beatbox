<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Check, Copy, ExternalLink, Eye, Heart, Link, Trash2, Unlink } from '@lucide/svelte'

  import type { PageProps } from './$types'

  // The user's songs: open one, share it (or stop sharing), and see how shared
  // songs are doing. "Shared" narrows the list to the songs with a live link.
  let { data, form }: PageProps = $props()
  let onlyShared = $state(false)
  let copied: null | string = $state(null)

  const shown = $derived(onlyShared ? data.songs.filter((s) => s.shareId) : data.songs)
  const sharedCount = $derived(data.songs.filter((s) => s.shareId).length)
  const shareUrl = (shareId: string) =>
    new URL(resolve('/s/[shareId]', { shareId }), page.url.origin).toString()
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const plural = (n: number, word: string) => (n === 1 ? word : word + 's')

  async function copy(shareId: string) {
    await navigator.clipboard.writeText(shareUrl(shareId))
    copied = shareId
    setTimeout(() => (copied = copied === shareId ? null : copied), 2000)
  }

  const tab = (on: boolean) => [
    'rounded-md px-3 py-1 text-sm font-medium transition',
    on ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  ]
  const small =
    'flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-800'
</script>

<svelte:head>
  <title>My songs · Beatbox</title>
</svelte:head>

<section
  id="my-songs"
  class="mx-auto max-w-4xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div class="flex flex-wrap items-center gap-3">
    <h1 class="mr-auto text-xs font-bold uppercase tracking-[0.2em] text-amber-400">My songs</h1>
    <div class="flex gap-1 rounded-lg bg-zinc-900 p-1" role="group" aria-label="Show">
      <button
        id="show-all"
        type="button"
        aria-pressed={!onlyShared}
        class={tab(!onlyShared)}
        onclick={() => (onlyShared = false)}
      >
        All ({data.songs.length})
      </button>
      <button
        id="show-shared"
        type="button"
        aria-pressed={onlyShared}
        class={tab(onlyShared)}
        onclick={() => (onlyShared = true)}
      >
        Shared ({sharedCount})
      </button>
    </div>
  </div>

  <p class="text-sm text-zinc-400">
    Sharing a song makes a link anyone can open to listen to it. They can't change it. Stop sharing
    and the link stops working.
  </p>

  {#if form && 'error' in form}
    <p role="alert" class="text-sm text-red-300">{form.error}</p>
  {/if}

  <ul id="song-list" class="space-y-2">
    {#each shown as song (song.id)}
      <li
        id={'song-row-' + song.id}
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
      >
        <div class="mr-auto min-w-0">
          <a
            href={resolve('/songs/[id]', { id: song.id })}
            class="block truncate font-semibold text-zinc-100 hover:text-amber-300">{song.name}</a
          >
          <span class="text-xs text-zinc-500">Changed {when.format(song.updatedAt)}</span>
        </div>

        <span
          class="flex items-center gap-1 text-sm text-zinc-400"
          title="Visits by other people, once a day each"
        >
          <Eye class="size-4" />{song.views}<span class="sr-only">
            {plural(song.views, 'view')}</span
          >
        </span>
        <span class="flex items-center gap-1 text-sm text-zinc-400" title="Likes">
          <Heart class="size-4" />{song.likes}<span class="sr-only">
            {plural(song.likes, 'like')}</span
          >
        </span>

        {#if song.shareId}
          <div class="flex items-center gap-1.5">
            <button type="button" class={small} onclick={() => song.shareId && copy(song.shareId)}>
              {#if copied === song.shareId}<Check class="size-3.5" /> Copied{:else}<Copy
                  class="size-3.5"
                /> Copy link{/if}
            </button>
            <a
              class={small}
              href={resolve('/s/[shareId]', { shareId: song.shareId })}
              title="Open it the way others see it"
            >
              <ExternalLink class="size-3.5" /> Open
            </a>
            <form method="POST" action="?/unshare" use:enhance>
              <input type="hidden" name="id" value={song.id} />
              <button
                id={'unshare-' + song.id}
                type="submit"
                class={[small, 'hover:border-red-400/60 hover:text-red-300']}
              >
                <Unlink class="size-3.5" /> Stop sharing
              </button>
            </form>
          </div>
        {:else}
          <form method="POST" action="?/share" use:enhance>
            <input type="hidden" name="id" value={song.id} />
            <button
              id={'share-' + song.id}
              type="submit"
              class="flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-zinc-900 transition hover:bg-amber-300"
            >
              <Link class="size-3.5" /> Share
            </button>
          </form>
        {/if}
        <form
          method="POST"
          action="?/delete"
          use:enhance={({ cancel }) => {
            if (!confirm(`Delete "${song.name}"? This can't be undone.`)) cancel()
          }}
        >
          <input type="hidden" name="id" value={song.id} />
          <button
            id={'delete-' + song.id}
            type="submit"
            title="Delete song"
            class={[small, 'hover:border-red-400/60 hover:text-red-300']}
          >
            <Trash2 class="size-3.5" /> Delete
          </button>
        </form>
      </li>
    {:else}
      <li
        class="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500"
      >
        {#if onlyShared}
          None of your songs are shared yet. Press <span class="text-zinc-300">Share</span> on one to
          get its link.
        {:else}
          No saved songs yet. Make one and press <span class="text-zinc-300">Save</span>.
          <a href={resolve('/')} class="text-amber-300 hover:underline">Start a song</a>
        {/if}
      </li>
    {/each}
  </ul>
</section>
