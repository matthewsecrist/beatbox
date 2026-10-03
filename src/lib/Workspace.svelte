<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { resolve } from '$app/paths'
  import {
    ChevronDown,
    CircleAlert,
    Info,
    Library,
    Play,
    Redo2,
    Settings2,
    Square,
    Undo2,
    X
  } from '@lucide/svelte'
  import { onMount, untrack } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { Instrument } from './effects.js'
  import type {
    KitId,
    LoadKitReply,
    LoadPresetReply,
    SaveKitReply,
    SavePresetReply,
    SaveSongReply,
    Scene,
    StateDetail,
    SynthParams,
    Voices,
    WorkspaceData
  } from './types.js'

  import Arranger from './Arranger.svelte'
  import DrumMachine from './DrumMachine.svelte'
  import { effects } from './effects.js'
  import Effects from './Effects.svelte'
  import { help } from './help.js'
  import InfoTip from './Info.svelte'
  import LoopBrowser from './LoopBrowser.svelte'
  import { keepPendingSong, takePendingSong } from './pending_song.js'
  import { SongStore } from './song.svelte.js'
  import Synth from './Synth.svelte'
  import { createTapTempo } from './tap_tempo.js'
  import { transport } from './transport.js'

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
  // An example or a shared song opens with its name.
  let name = $state(start.song?.name ?? start.example?.name ?? start.shared?.name ?? '')
  let dirty = $state(false)
  let saving = $state(false)
  let songs = $state(start.songs)
  let presets = $state(start.presets)
  let kits = $state(start.kits)
  let flash: null | { kind: 'error' | 'info'; message: string } = $state(
    start.notice ? { kind: 'error', message: start.notice } : null
  )
  let menuOpen = $state(false)
  let libraryOpen = $state(false)
  // Signed out, everything plays but nothing is saved: Save becomes a link to sign
  // in, and Open lists only the examples. Signing in reloads the page, so this never
  // changes while mounted.
  const signedIn = start.signedIn
  // Someone's shared song: it plays, but can't be changed or saved (see /s/[shareId]).
  const readOnly = start.shared !== null

  const store = new SongStore(
    start.song ?? start.example ?? start.shared?.song ?? null,
    () => (dirty = true),
    { readOnly }
  )
  // The track open in the editor (UI only).
  let track: Instrument = $state('synth')
  let audioReady = $state(false)

  // The song's tempo (saved as drums.bpm) drives the shared transport, so drums,
  // pads and arp follow it (sections with their own tempo change it through the
  // arranger). The effects bus follows the song's settings, and its tempo-synced
  // delay the tempo playing: a section's own while it plays (set as the arranger
  // announces it, a moment before its first beat).
  let sectionBpm: null | number = $state(null)
  $effect(() => transport.setBpm(store.drums.bpm))
  $effect(() => effects.set($state.snapshot(store.effects), sectionBpm ?? store.drums.bpm))

  // Tap along to set the song tempo; each tap's event time, so a busy page doesn't skew it.
  const tapper = createTapTempo()
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

  async function saveKit(kitName: string, kit: KitId, voices: Voices): Promise<SaveKitReply> {
    const reply = await request<SaveKitReply>('POST', '/api/kits', { kit, name: kitName, voices })
    if ('kits' in reply) kits = reply.kits
    return reply
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

  function tapTempo(e: MouseEvent) {
    const tapped = tapper.tap(e.timeStamp)
    if (tapped) store.tapTempo(tapped.bpm, tapped.first)
  }

  const loadPreset = (id: string): Promise<LoadPresetReply> =>
    request<LoadPresetReply>('GET', `/api/presets/${encodeURIComponent(id)}`)

  const loadKit = (id: string): Promise<LoadKitReply> =>
    request<LoadKitReply>('GET', `/api/kits/${encodeURIComponent(id)}`)

  const menuHeading =
    'px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase select-none'
  const menuItem = 'block truncate rounded-md px-3 py-2 text-sm transition hover:bg-zinc-800'

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

  // Song-bar transport: Play song plays the arrangement (the Arranger listens for
  // `beatbox:song`), or, with no sections yet, starts the drums and every filled
  // loop pad. Stop stops whatever is playing. The instruments report their state
  // as `beatbox:state`, so the button follows them even when started individually.
  const playingBy = new SvelteMap<string, boolean>()
  let anyPlaying = $state(false)

  function toggleTransport() {
    if (!anyPlaying && !audioReady) return
    if (anyPlaying) {
      window.dispatchEvent(new CustomEvent('beatbox:transport', { detail: { play: false } }))
    } else if (store.arrangement.length) {
      window.dispatchEvent(new CustomEvent('beatbox:song', { detail: { play: true } }))
    } else {
      window.dispatchEvent(new CustomEvent('beatbox:transport', { detail: { play: true } }))
    }
  }

  onMount(() => {
    // Just signed in with a song made while signed out: carry on with it, unsaved.
    const pending =
      start.signedIn && !start.song && !start.example && !readOnly ? takePendingSong() : null
    if (pending) {
      store.replace(pending.song)
      name = pending.name
      dirty = true
      flash = { kind: 'info', message: 'Restored the song you were working on. Save to keep it.' }
    }

    const onState = (e: CustomEvent<StateDetail>) => {
      playingBy.set(e.detail.source, e.detail.playing)
      anyPlaying = [...playingBy.values()].some(Boolean)
      if (e.detail.source === 'song' && !e.detail.playing) sectionBpm = null
    }
    const onScene = (e: CustomEvent<Scene>) => (sectionBpm = e.detail.bpm)
    window.addEventListener('beatbox:state', onState)
    window.addEventListener('beatbox:scene', onScene)
    window.addEventListener('keydown', onUndoKey)
    // Ask already-mounted instruments to report in.
    window.dispatchEvent(new CustomEvent('beatbox:report', { detail: undefined }))
    return () => {
      window.removeEventListener('beatbox:state', onState)
      window.removeEventListener('beatbox:scene', onScene)
      window.removeEventListener('keydown', onUndoKey)
    }
  })
</script>

<svelte:head>
  <title>{name || 'New song'} · Beatbox</title>
</svelte:head>

<div
  id="song-bar"
  class="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-lg shadow-black/40"
>
  <button
    id="transport"
    type="button"
    aria-pressed={anyPlaying}
    disabled={!anyPlaying && !audioReady}
    title={anyPlaying
      ? 'Stop everything'
      : store.arrangement.length
        ? 'Play the arrangement from the start'
        : 'No arrangement yet: play the drums and every loop pad'}
    onclick={toggleTransport}
    class="group flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 shadow shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 aria-pressed:bg-zinc-100 aria-pressed:shadow-none aria-pressed:hover:bg-white"
  >
    <Play class="size-4 fill-current group-aria-pressed:hidden" />
    <Square class="hidden size-4 fill-current group-aria-pressed:block" />
    <span>{anyPlaying ? 'Stop' : 'Play song'}</span>
  </button>

  {#if readOnly}
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <h1 id="song-name" class="truncate px-2 text-lg font-semibold tracking-tight">{name}</h1>
      <span
        id="listen-only"
        title="This is someone's shared song: you can listen, but not change it"
        class="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400"
        >Listen only</span
      >
    </div>
  {:else}
    <form id="song-form" onsubmit={saveSong} class="flex min-w-0 flex-1 items-center gap-2">
      <span
        id="song-status"
        data-dirty={String(dirty)}
        class={[
          'size-2 shrink-0 rounded-full transition',
          dirty ? 'bg-amber-400' : 'bg-emerald-500'
        ]}
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
  {/if}

  <label class="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400" for="tempo">
    <span class="flex items-center gap-1"
      >Tempo<InfoTip label="Tempo" text={help('tempo') ?? ''} /></span
    >
    <input
      id="tempo"
      type="range"
      min="60"
      max="200"
      step="1"
      value={store.drums.bpm}
      disabled={readOnly}
      oninput={(e) => store.setDrums({ bpm: Number(e.currentTarget.value) })}
      class="w-28 cursor-pointer accent-amber-400 disabled:cursor-default"
    />
    <span class="w-8 font-mono text-amber-300 tabular-nums">{store.drums.bpm}</span>
  </label>
  {#if !readOnly}
    <div class="-ml-2 flex items-center gap-1">
      <button
        id="tap-tempo"
        type="button"
        onclick={tapTempo}
        class="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
      >
        Tap
      </button>
      <InfoTip label="Tap tempo" text={help('tap_tempo') ?? ''} />
    </div>
  {/if}
  {#if !readOnly}
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

    <button
      id="open-library"
      type="button"
      aria-haspopup="dialog"
      title="Loop Browser"
      onclick={() => (libraryOpen = true)}
      class="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
    >
      <Library class="size-4" />
      Loops
    </button>
  {/if}

  <!-- Settings for the whole song: its effects (delay, reverb, sends, bitcrusher, sidechain, master). -->
  <details id="song-settings" class="group relative">
    <summary
      class="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 group-open:border-amber-400/60"
    >
      <Settings2 class="size-4" />
      Song settings
      <ChevronDown class="size-4 transition group-open:rotate-180" />
    </summary>
    <div
      class="absolute right-0 z-20 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl shadow-black/60"
    >
      <Effects {store} />
    </div>
  </details>

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
      {#if signedIn}
        <li class={menuHeading}>Your songs</li>
        {#each songs as s (s.id)}
          <li>
            <a
              id={'open-song-' + s.id}
              href={resolve('/songs/[id]', { id: s.id })}
              onclick={openSong}
              class={[menuItem, song?.id === s.id ? 'text-amber-300' : 'text-zinc-200']}
            >
              {s.name}
            </a>
          </li>
        {:else}
          <li class="px-3 py-2 text-sm text-zinc-500">No saved songs yet</li>
        {/each}
        <li>
          <a
            id="manage-songs"
            href={resolve('/songs')}
            onclick={openSong}
            class={[menuItem, 'text-zinc-400']}>All my songs and sharing…</a
          >
        </li>
      {/if}
      <li id="examples-heading" class={menuHeading}>Examples</li>
      {#each start.examples as ex (ex.slug)}
        <li>
          <a
            id={'open-example-' + ex.slug}
            href={resolve('/examples/[slug]', { slug: ex.slug })}
            onclick={openSong}
            class={[
              menuItem,
              !song && start.example?.slug === ex.slug ? 'text-amber-300' : 'text-zinc-200'
            ]}
          >
            {ex.name}
          </a>
        </li>
      {/each}
    </ul>
  </details>
</div>

<Arranger {store} {audioReady} bind:track />
<div class="flex flex-col gap-4">
  <Synth
    bpm={sectionBpm ?? store.drums.bpm}
    {store}
    {presets}
    {savePreset}
    {loadPreset}
    canSave={signedIn}
    onAudioReady={(ready: boolean) => {
      audioReady = ready
    }}
    selected={track === 'synth'}
  />
  <DrumMachine {store} {kits} {saveKit} {loadKit} canSave={signedIn} selected={track === 'drums'} />
</div>
{#if !readOnly}<LoopBrowser {store} bind:open={libraryOpen} />{/if}

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
