<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { ChevronDown, CircleAlert, Info, Play, Redo2, Square, Undo2, X } from '@lucide/svelte'
  import { onMount, untrack } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type {
    LoadPresetReply,
    SavePresetReply,
    SaveSongReply,
    StateDetail,
    SynthParams,
    WorkspaceData
  } from './types.js'

  import Arranger from './Arranger.svelte'
  import DrumMachine from './DrumMachine.svelte'
  import { keepPendingSong, takePendingSong } from './pending_song.js'
  import { SongStore } from './song.svelte.js'
  import Synth from './Synth.svelte'

  // The music workspace: synth, loop pads and drum machine, saved together as a song.
  //
  // The open song's working copy is a Yjs document (`store`): the instruments read
  // it and edit it, and every edit goes through one undo history. Save sends its
  // contents to the server. The page remounts this whole component, with a fresh
  // store and history, when a different song is opened (see the `{#key}` in the
  // routes).
  let { data }: { data: WorkspaceData } = $props()
  const start = untrack(() => data)

  let song: null | { id: string; name: string } = $state(
    start.song ? { id: start.song.id, name: start.song.name } : null
  )
  let name = $state(start.song?.name ?? '')
  let dirty = $state(false)
  let saving = $state(false)
  let songs = $state(start.songs)
  let presets = $state(start.presets)
  let flash: null | { kind: 'error' | 'info'; message: string } = $state(
    start.notice ? { kind: 'error', message: start.notice } : null
  )
  let menuOpen = $state(false)
  // Signed out, everything plays but nothing is saved: Save and Open become a link
  // to sign in. Signing in reloads the page, so this never changes while mounted.
  const signedIn = start.signedIn

  const store = new SongStore(start.song, () => (dirty = true))

  // Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z or Ctrl+Y redoes, except while typing in a
  // field (which keeps the browser's own text undo).
  function onUndoKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const el = e.target
    if (
      el instanceof HTMLElement &&
      (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
    ) {
      return
    }
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      store.redo()
    }
  }

  function rename(e: Event & { currentTarget: HTMLInputElement }) {
    name = e.currentTarget.value
    dirty = dirty || name !== (song?.name ?? '')
  }

  async function request<T>(
    method: string,
    url: string,
    body?: object
  ): Promise<T | { error: string }> {
    const res = await fetch(url, {
      method,
      ...(body
        ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
        : {})
    })
    try {
      return (await res.json()) as T | { error: string }
    } catch {
      return { error: `${res.status} ${res.statusText}` }
    }
  }

  async function savePreset(presetName: string, params: SynthParams): Promise<SavePresetReply> {
    const reply = await request<SavePresetReply>('POST', '/api/presets', {
      name: presetName,
      params
    })
    if ('presets' in reply) presets = reply.presets
    return reply
  }

  async function saveSong(e: SubmitEvent) {
    e.preventDefault()
    if (saving || !signedIn) return
    saving = true
    const body = { ...store.toSongDoc(), name }
    const reply = await (song
      ? request<SaveSongReply>('PUT', `/api/songs/${song.id}`, body)
      : request<SaveSongReply>('POST', '/api/songs', body))
    saving = false
    if ('error' in reply) {
      flash = { kind: 'error', message: "Couldn't save: " + reply.error }
      return
    }
    song = reply.song
    name = reply.song.name
    songs = reply.songs
    dirty = false
    flash = { kind: 'info', message: `Saved “${reply.song.name}”` }
    // Just saved a new song: show its URL without remounting, so the live state stays.
    const path = resolve('/songs/[id]', { id: reply.song.id })
    if (location.pathname !== path) replaceState(path, {})
  }

  const loadPreset = (id: string): Promise<LoadPresetReply> =>
    request<LoadPresetReply>('GET', `/api/presets/${encodeURIComponent(id)}`)

  const discardOk = () => !dirty || confirm('Discard unsaved changes?')

  function newSong(e: MouseEvent) {
    e.preventDefault()
    // Always reload, even from "/", so the instruments remount blank.
    if (discardOk()) void goto(resolve('/'), { invalidateAll: true })
  }

  function openSong(e: MouseEvent) {
    if (!discardOk()) return e.preventDefault()
    menuOpen = false
  }

  // Signing in leaves the page (the link is followed from the email), so an unsaved
  // song is kept in the browser and restored once signed in (see onMount). If the
  // browser won't keep it, ask before losing it.
  function signIn(e: MouseEvent) {
    if (!dirty) return
    if (!keepPendingSong({ name, song: store.toSongDoc() }) && !discardOk()) e.preventDefault()
  }

  // Global transport: starts/stops the drums and every filled loop pad. The
  // instruments report their state as `beatbox:state`, so the label follows them
  // even when started/stopped individually.
  const playingBy = new SvelteMap<string, boolean>()
  let anyPlaying = $state(false)

  function toggleTransport() {
    window.dispatchEvent(new CustomEvent('beatbox:transport', { detail: { play: !anyPlaying } }))
  }

  onMount(() => {
    // Just signed in with a song made while signed out: carry on with it, unsaved.
    const pending = start.signedIn && !start.song ? takePendingSong() : null
    if (pending) {
      store.replace(pending.song)
      name = pending.name
      dirty = true
      flash = { kind: 'info', message: 'Restored the song you were working on. Save to keep it.' }
    }

    const onState = (e: CustomEvent<StateDetail>) => {
      playingBy.set(e.detail.source, e.detail.playing)
      anyPlaying = [...playingBy.values()].some(Boolean)
    }
    window.addEventListener('beatbox:state', onState)
    window.addEventListener('keydown', onUndoKey)
    // Ask already-mounted instruments to report in.
    window.dispatchEvent(new CustomEvent('beatbox:report', { detail: undefined }))
    return () => {
      window.removeEventListener('beatbox:state', onState)
      window.removeEventListener('keydown', onUndoKey)
    }
  })
</script>

<svelte:head>
  <title>{song ? song.name : 'New song'} · Beatbox</title>
</svelte:head>

<div
  id="song-bar"
  class="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-lg shadow-black/40"
>
  <button
    id="transport"
    type="button"
    aria-pressed={anyPlaying}
    onclick={toggleTransport}
    class="group flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 shadow shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 aria-pressed:bg-zinc-100 aria-pressed:shadow-none aria-pressed:hover:bg-white"
  >
    <Play class="size-4 fill-current group-aria-pressed:hidden" />
    <Square class="hidden size-4 fill-current group-aria-pressed:block" />
    <span>{anyPlaying ? 'Stop all' : 'Play all'}</span>
  </button>

  <form id="song-form" onsubmit={saveSong} class="flex min-w-0 flex-1 items-center gap-2">
    <span
      id="song-status"
      data-dirty={String(dirty)}
      class={['size-2 shrink-0 rounded-full transition', dirty ? 'bg-amber-400' : 'bg-emerald-500']}
      title={dirty ? 'Unsaved changes' : 'Saved'}
    ></span>
    <div class="min-w-0 flex-1">
      <input
        id="song-name"
        name="name"
        type="text"
        maxlength="60"
        placeholder="Untitled song"
        aria-label="Song name"
        value={name}
        oninput={rename}
        class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold tracking-tight text-zinc-100 placeholder:text-zinc-600 transition hover:border-zinc-700 focus:border-amber-400 focus:outline-none"
      />
    </div>
    {#if signedIn}
      <button
        id="save-song"
        type="submit"
        disabled={saving}
        class="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:opacity-60"
      >
        Save
      </button>
    {:else}
      <a
        id="sign-in-to-save"
        href={resolve('/login')}
        onclick={signIn}
        title="Songs are saved to your account"
        class="shrink-0 rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95"
      >
        Sign in to save
      </a>
    {/if}
  </form>

  <div class="flex items-center" role="group" aria-label="History">
    <button
      id="undo"
      type="button"
      aria-label="Undo"
      title="Undo (Ctrl/Cmd+Z)"
      disabled={!store.canUndo}
      onclick={() => store.undo()}
      class="flex size-8 items-center justify-center rounded-md text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
    >
      <Undo2 class="size-4" />
    </button>
    <button
      id="redo"
      type="button"
      aria-label="Redo"
      title="Redo (Shift+Ctrl/Cmd+Z)"
      disabled={!store.canRedo}
      onclick={() => store.redo()}
      class="flex size-8 items-center justify-center rounded-md text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
    >
      <Redo2 class="size-4" />
    </button>
  </div>

  <a
    id="new-song"
    href={resolve('/')}
    onclick={newSong}
    class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
  >
    New
  </a>

  {#if signedIn}
    <details id="song-menu" class="group relative" bind:open={menuOpen}>
      <summary
        class="flex cursor-pointer list-none items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700"
      >
        Open <ChevronDown class="size-4 transition group-open:rotate-180" />
      </summary>
      <ul
        class="absolute right-0 z-20 mt-2 max-h-80 w-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/60"
      >
        {#each songs as s (s.id)}
          <li>
            <a
              id={'open-song-' + s.id}
              href={resolve('/songs/[id]', { id: s.id })}
              onclick={openSong}
              class={[
                'block truncate rounded-md px-3 py-2 text-sm transition hover:bg-zinc-800',
                song?.id === s.id ? 'text-amber-300' : 'text-zinc-200'
              ]}
            >
              {s.name}
            </a>
          </li>
        {:else}
          <li class="px-3 py-2 text-sm text-zinc-500">No saved songs yet</li>
        {/each}
      </ul>
    </details>
  {/if}
</div>

<Synth {store} {presets} {savePreset} {loadPreset} canSave={signedIn} />
<DrumMachine {store} />
<Arranger {store} />

{#if flash}
  <div id={'flash-' + flash.kind} role="alert" class="fixed top-4 right-4 z-50">
    <div
      class={[
        'flex w-80 items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg sm:w-96',
        flash.kind === 'info'
          ? 'border-sky-200 bg-sky-50 text-sky-900'
          : 'border-red-200 bg-red-50 text-red-900'
      ]}
    >
      {#if flash.kind === 'info'}
        <Info class="size-5 shrink-0" />
      {:else}
        <CircleAlert class="size-5 shrink-0" />
      {/if}
      <p class="flex-1">{flash.message}</p>
      <button
        type="button"
        class="cursor-pointer opacity-40 transition hover:opacity-70"
        aria-label="close"
        onclick={() => (flash = null)}
      >
        <X class="size-5" />
      </button>
    </div>
  </div>
{/if}
