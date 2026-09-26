<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { ChevronDown, CircleAlert, Info, Play, Square, X } from '@lucide/svelte'
  import { onMount, untrack } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type {
    Drums,
    LoadPresetReply,
    Loop,
    SavePresetReply,
    SaveSongReply,
    Section,
    SongDoc,
    StateDetail,
    SynthParams,
    WorkspaceData
  } from './types.js'

  import Arranger from './Arranger.svelte'
  import DrumMachine from './DrumMachine.svelte'
  import Synth from './Synth.svelte'

  // The music workspace: synth, loop pads and drum machine, saved together as a song.
  //
  // The instruments own the live state and report each change here, into `doc`, the
  // unsaved working copy. Save sends `doc` to the server. `initial` is what the
  // instruments mount with; the page remounts this whole component when a different
  // song is opened (see the `{#key}` in the routes).
  let { data }: { data: WorkspaceData } = $props()
  const start = untrack(() => data)

  const initial: SongDoc = {
    arrangement: start.song?.arrangement ?? [],
    drums: start.song?.drums ?? null,
    loops: start.song?.loops ?? [],
    synth: start.song?.synth ?? null
  }
  const doc = { ...initial }

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

  function change<K extends keyof SongDoc>(key: K, value: SongDoc[K]) {
    doc[key] = value
    dirty = true
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
    if (saving) return
    saving = true
    const body = { ...doc, name }
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

  // Global transport: starts/stops the drums and every filled loop pad. The
  // instruments report their state as `beatbox:state`, so the label follows them
  // even when started/stopped individually.
  const playingBy = new SvelteMap<string, boolean>()
  let anyPlaying = $state(false)

  function toggleTransport() {
    window.dispatchEvent(new CustomEvent('beatbox:transport', { detail: { play: !anyPlaying } }))
  }

  onMount(() => {
    const onState = (e: CustomEvent<StateDetail>) => {
      playingBy.set(e.detail.source, e.detail.playing)
      anyPlaying = [...playingBy.values()].some(Boolean)
    }
    window.addEventListener('beatbox:state', onState)
    // Ask already-mounted instruments to report in.
    window.dispatchEvent(new CustomEvent('beatbox:report', { detail: undefined }))
    return () => window.removeEventListener('beatbox:state', onState)
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
    <button
      id="save-song"
      type="submit"
      disabled={saving}
      class="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:opacity-60"
    >
      Save
    </button>
  </form>

  <a
    id="new-song"
    href={resolve('/')}
    onclick={newSong}
    class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
  >
    New
  </a>

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
</div>

<Synth
  {presets}
  params={initial.synth}
  loops={initial.loops}
  onparams={(params: SynthParams) => change('synth', params)}
  onloops={(loops: Loop[]) => change('loops', loops)}
  {savePreset}
  {loadPreset}
/>
<DrumMachine drums={initial.drums} onchange={(drums: Drums) => change('drums', drums)} />
<Arranger
  sections={initial.arrangement}
  onchange={(sections: Section[]) => change('arrangement', sections)}
/>

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
