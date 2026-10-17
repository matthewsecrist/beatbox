<script lang="ts">
  import { ArrowRight, RotateCcw, Trophy, Volume2 } from '@lucide/svelte'

  import { playGroups } from './sound.js'
  import { type Question } from './theory.js'
  import { button, panel } from './ui.js'

  // A short quiz, made fresh from `questions` each time it starts. Questions with
  // sounds play them when they come up (and on Listen again). `oncomplete` gets
  // the score at the end.
  let {
    id,
    oncomplete,
    questions
  }: {
    id: string
    oncomplete?: (score: number, total: number) => void
    questions: () => Question[]
  } = $props()

  let list: Question[] = $state([])
  let index = $state(0)
  let chosen: null | string = $state(null)
  let score = $state(0)

  const question = $derived(list[index])
  const done = $derived(list.length > 0 && index >= list.length)

  function answer(choice: string) {
    if (chosen !== null || !question) return
    chosen = choice
    if (choice === question.answer) score++
  }

  function listen(q: Question | undefined) {
    if (q?.play) playGroups(q.play, { gap: 0.7, length: 0.6, sounds: q.sounds ?? [] })
  }

  function next() {
    chosen = null
    index++
    if (index >= list.length) oncomplete?.(score, list.length)
    else listen(list[index])
  }

  function start() {
    list = questions()
    index = 0
    score = 0
    chosen = null
    listen(list[0])
  }

  const cheer = (s: number, total: number) =>
    s === total
      ? 'Perfect score! You really get this.'
      : s >= total * 0.7
        ? 'Great job! You’ve got the main idea.'
        : 'Good start. Scroll up, play with the examples, and give it another go.'
</script>

<div {id} class={panel}>
  {#if list.length === 0}
    <div class="flex flex-wrap items-center gap-3">
      <p class="mr-auto text-sm text-zinc-300">Ready to test yourself? It only takes a minute.</p>
      <button id={`${id}-start`} type="button" class={button} onclick={start}>
        Start the quiz <ArrowRight class="size-4" />
      </button>
    </div>
  {:else if done}
    <div class="flex flex-wrap items-center gap-3" role="status">
      <Trophy class="size-6 text-amber-300" />
      <p class="mr-auto text-sm text-zinc-200">
        <span class="font-semibold text-amber-200">{score} out of {list.length}.</span>
        {cheer(score, list.length)}
      </p>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        onclick={start}
      >
        <RotateCcw class="size-4" /> Try again
      </button>
    </div>
  {:else if question}
    <div class="flex items-center justify-between text-xs text-zinc-500">
      <span>Question {index + 1} of {list.length}</span>
      <span>Score: {score}</span>
    </div>
    <p class="font-medium text-zinc-100">{question.prompt}</p>
    {#if question.play}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        onclick={() => listen(question)}
      >
        <Volume2 class="size-4" /> Listen again
      </button>
    {/if}
    <div class="grid gap-2 sm:grid-cols-2">
      {#each question.choices as choice (choice)}
        <button
          type="button"
          disabled={chosen !== null}
          onclick={() => answer(choice)}
          class={[
            'rounded-lg border px-3 py-2 text-left text-sm font-medium transition',
            chosen === null &&
              'border-zinc-700 text-zinc-200 hover:border-amber-400/60 hover:bg-zinc-800',
            chosen !== null &&
              choice === question.answer &&
              'border-emerald-400 bg-emerald-400/15 text-emerald-200',
            chosen !== null &&
              choice === chosen &&
              choice !== question.answer &&
              'border-red-400 bg-red-400/10 text-red-200',
            chosen !== null &&
              choice !== chosen &&
              choice !== question.answer &&
              'border-zinc-800 text-zinc-500'
          ]}
        >
          {choice}
        </button>
      {/each}
    </div>
    {#if chosen !== null}
      <div class="flex flex-wrap items-center gap-3" role="status">
        <p class="mr-auto text-sm text-zinc-300">
          <span
            class={[
              'font-semibold',
              chosen === question.answer ? 'text-emerald-300' : 'text-red-300'
            ]}>{chosen === question.answer ? 'Yes!' : 'Not this time.'}</span
          >
          {question.explain}
        </p>
        <button type="button" class={button} onclick={next}>
          {index + 1 < list.length ? 'Next' : 'See my score'}
          <ArrowRight class="size-4" />
        </button>
      </div>
    {/if}
  {/if}
</div>
