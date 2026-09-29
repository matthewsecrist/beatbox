<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte'

  // A row of tabs over one panel: the parent renders the chosen tab's content as
  // `children`. Arrow keys, Home and End move between tabs (and pick them).
  let {
    children,
    id,
    label,
    tabs,
    value = $bindable()
  }: {
    children: Snippet
    id: string
    label: string
    tabs: [T, string][]
    value: T
  } = $props()

  function onkeydown(e: KeyboardEvent) {
    const i = tabs.findIndex(([t]) => t === value)
    const n = tabs.length
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowLeft'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1
    const next = tabs[to]
    if (!next) return
    e.preventDefault()
    value = next[0]
    document.getElementById(`${id}-tab-${next[0]}`)?.focus()
  }
</script>

<div
  {id}
  role="tablist"
  aria-label={label}
  tabindex="-1"
  {onkeydown}
  class="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-zinc-900 p-1"
>
  {#each tabs as [tab, text] (tab)}
    <button
      id={`${id}-tab-${tab}`}
      type="button"
      role="tab"
      aria-selected={value === tab}
      aria-controls={`${id}-panel`}
      tabindex={value === tab ? 0 : -1}
      onclick={() => (value = tab)}
      class={[
        'shrink-0 rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95',
        value === tab
          ? 'bg-zinc-100 text-zinc-900'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      ]}
    >
      {text}
    </button>
  {/each}
</div>
<div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${value}`} class="space-y-4">
  {@render children()}
</div>
