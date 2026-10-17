<script lang="ts">
  import { resolve } from '$app/paths'
  import ChordExplorer from '$lib/learn/ChordExplorer.svelte'
  import IntervalExplorer from '$lib/learn/IntervalExplorer.svelte'
  import Keyboard from '$lib/learn/Keyboard.svelte'
  import { saveResult } from '$lib/learn/progress.js'
  import Quiz from '$lib/learn/Quiz.svelte'
  import RhythmGrid from '$lib/learn/RhythmGrid.svelte'
  import ScaleExplorer from '$lib/learn/ScaleExplorer.svelte'
  import { stopAll } from '$lib/learn/sound.js'
  import SoundLab from '$lib/learn/SoundLab.svelte'
  import { ArrowLeft, ArrowRight, Sparkles } from '@lucide/svelte'
  import { onMount } from 'svelte'

  import type { PageProps } from './$types'

  // One lesson: its blocks in order, then where to try it in the workstation and
  // the way to the next lesson.
  let { data }: PageProps = $props()
  const lesson = $derived(data.lesson)

  // Notes still ringing stop when leaving the lesson.
  onMount(() => stopAll)
</script>

<svelte:head>
  <title>{lesson.title} · Learn · Beatbox</title>
</svelte:head>

<article
  id="lesson"
  class="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/50 sm:p-6"
>
  <header class="space-y-2">
    <a
      href={resolve('/learn')}
      class="flex w-fit items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-400 hover:text-amber-300"
    >
      <ArrowLeft class="size-3.5" /> Learn · Lesson {data.number}
    </a>
    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>
    <p class="text-zinc-400">{lesson.summary}</p>
  </header>

  {#each lesson.blocks as block, i (`${data.lesson.slug}-${i}`)}
    {#if block.kind === 'text'}
      <section class="space-y-2">
        {#if block.heading}<h2 class="text-lg font-semibold text-zinc-100">{block.heading}</h2>{/if}
        {#each block.body as paragraph, p (p)}
          <p class="leading-relaxed text-zinc-300">{paragraph}</p>
        {/each}
      </section>
    {:else if block.kind === 'keyboard'}
      <Keyboard id={`keyboard-${i}`} low={48} high={83} />
    {:else if block.kind === 'intervals'}
      <IntervalExplorer />
    {:else if block.kind === 'scales'}
      <ScaleExplorer />
    {:else if block.kind === 'chords'}
      <ChordExplorer />
    {:else if block.kind === 'sound'}
      <SoundLab />
    {:else if block.kind === 'rhythm'}
      <RhythmGrid id={`rhythm-${i}`} goal={block.goal} target={block.target} />
    {:else if block.kind === 'quiz'}
      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-zinc-100">Quick quiz</h2>
        <Quiz
          id="quiz"
          questions={block.questions}
          oncomplete={(score: number, total: number) => saveResult(lesson.slug, score, total)}
        />
      </section>
    {/if}
  {/each}

  <aside id="try-it" class="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
    <Sparkles class="size-5 shrink-0 text-amber-300" />
    <div class="space-y-2 text-sm">
      <p class="font-semibold text-amber-200">Try it in Beatbox</p>
      <p class="text-zinc-300">{lesson.tryIt}</p>
      <a href={resolve('/')} class="inline-block font-medium text-amber-300 hover:underline"
        >Open the workstation</a
      >
    </div>
  </aside>

  <nav class="flex flex-wrap justify-between gap-3 border-t border-zinc-800 pt-4 text-sm">
    {#if data.previous}
      <a
        href={resolve('/learn/[slug]', { slug: data.previous.slug })}
        class="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100"
      >
        <ArrowLeft class="size-4" />
        {data.previous.title}
      </a>
    {:else}
      <span></span>
    {/if}
    {#if data.next}
      <a
        id="next-lesson"
        href={resolve('/learn/[slug]', { slug: data.next.slug })}
        class="flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200"
      >
        Next: {data.next.title}
        <ArrowRight class="size-4" />
      </a>
    {:else}
      <a href={resolve('/learn')} class="font-semibold text-amber-300 hover:text-amber-200"
        >All lessons done? Back to Learn</a
      >
    {/if}
  </nav>
</article>
