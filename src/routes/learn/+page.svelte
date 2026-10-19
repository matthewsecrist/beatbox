<script lang="ts">
  import { resolve } from '$app/paths'
  import { LESSONS } from '$lib/learn/lessons.js'
  import { loadProgress, type Progress } from '$lib/learn/progress.js'
  import { ArrowRight, CircleCheck, GraduationCap } from '@lucide/svelte'
  import { onMount } from 'svelte'

  // The Learn section's front page: every lesson in order, in its part, with the
  // best quiz score from this browser.
  const PARTS = [
    {
      id: 'basics',
      intro: 'How music works: beats, notes, scales, chords and sound.',
      title: 'The basics'
    },
    {
      id: 'reading',
      intro: 'Crack the code of sheet music: notes on the staff, rhythms, and playing real tunes.',
      title: 'Reading music'
    },
    {
      id: 'making',
      intro: 'Put it to work with Beatbox’s tools, from your first arp to a finished song.',
      title: 'Making music'
    }
  ] as const

  let progress: Progress = $state({})
  const finished = $derived(LESSONS.filter((l) => progress[l.slug]).length)

  onMount(() => {
    progress = loadProgress()
  })
</script>

<svelte:head>
  <title>Learn · Beatbox</title>
</svelte:head>

<section
  id="learn"
  class="mx-auto max-w-4xl space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <div class="space-y-2">
    <h1 class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
      <GraduationCap class="size-4" /> Learn
    </h1>
    <p class="text-2xl font-bold tracking-tight">Make sense of the music you love.</p>
    <p class="text-sm text-zinc-400">
      No experience needed. {LESSONS.length} quick lessons, each with things to play with and a short
      quiz at the end. Turn your sound on, and go in order or jump to whatever you're curious about.
    </p>
    {#if finished > 0}
      <p id="learn-progress" class="text-sm text-amber-200">
        You've finished {finished} of {LESSONS.length} lessons.
      </p>
    {/if}
  </div>

  {#each PARTS as part (part.id)}
    <div class="space-y-3">
      <div>
        <h2 class="text-lg font-semibold">{part.title}</h2>
        <p class="text-sm text-zinc-400">{part.intro}</p>
      </div>
      <ol id={`lesson-list-${part.id}`} class="grid gap-3 sm:grid-cols-2">
        {#each LESSONS.filter((l) => l.part === part.id) as lesson (lesson.slug)}
          {@const result = progress[lesson.slug]}
          <li>
            <a
              id={'lesson-' + lesson.slug}
              href={resolve('/learn/[slug]', { slug: lesson.slug })}
              class="group flex h-full gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition hover:border-amber-400/60"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-amber-300"
                >{LESSONS.indexOf(lesson) + 1}</span
              >
              <span class="min-w-0 flex-1 space-y-1">
                <span class="block font-semibold group-hover:text-amber-300">{lesson.title}</span>
                <span class="block text-sm text-zinc-400">{lesson.summary}</span>
                {#if result}
                  <span class="flex items-center gap-1 text-xs text-emerald-300">
                    <CircleCheck class="size-3.5" /> Best quiz score: {result.score}/{result.total}
                  </span>
                {/if}
              </span>
              <ArrowRight
                class="size-4 shrink-0 self-center text-zinc-600 group-hover:text-amber-300"
              />
            </a>
          </li>
        {/each}
      </ol>
    </div>
  {/each}
</section>
