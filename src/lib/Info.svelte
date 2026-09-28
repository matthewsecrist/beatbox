<script lang="ts">
  import { Info } from '@lucide/svelte'

  // A small ⓘ that explains a control in plain words. The bubble shows while the
  // mouse is over it, on keyboard focus, and on a tap (touch screens have no
  // hover); a second tap, Escape or moving focus away hides it.
  let { label, text }: { label: string; text: string } = $props()
  const id = $props.id()
  let hovered = $state(false)
  let open = $state(false)
  // Near the right edge of the window, the bubble opens to the left instead.
  let flip = $state(false)
  let wrapper: HTMLSpanElement | undefined = $state()

  const BUBBLE = 248 // px: the bubble's width plus a margin

  function place() {
    const left = wrapper?.getBoundingClientRect().left ?? 0
    flip = left + BUBBLE > document.documentElement.clientWidth
  }
</script>

<span
  bind:this={wrapper}
  class="relative inline-flex align-middle normal-case tracking-normal"
  role="presentation"
  onpointerenter={(e) => {
    if (e.pointerType !== 'mouse') return // a tap opens it through the click instead
    place()
    hovered = true
  }}
  onpointerleave={() => (hovered = false)}
>
  <button
    type="button"
    aria-label={`What does ${label} do?`}
    aria-describedby={id}
    aria-expanded={open}
    onclick={(e) => {
      e.preventDefault() // inside a <label>: don't also poke its control
      place()
      open = !open
    }}
    onfocus={(e) => {
      place()
      open = e.currentTarget.matches(':focus-visible')
    }}
    onblur={() => (open = false)}
    onkeydown={(e) => e.key === 'Escape' && (open = false)}
    class="flex size-4 cursor-help items-center justify-center rounded-full text-zinc-500 transition hover:text-amber-300 focus-visible:text-amber-300 focus-visible:outline-none aria-expanded:text-amber-300"
  >
    <Info class="size-3.5" />
  </button>
  <!-- Hidden (not just invisible) when closed, so it never widens the page. -->
  <span
    {id}
    role="tooltip"
    class={[
      'pointer-events-none absolute top-full z-30 mt-1.5 w-60 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-left text-xs leading-relaxed font-normal text-zinc-200 shadow-xl shadow-black/60',
      flip ? 'right-0' : 'left-0',
      open || hovered ? 'block' : 'hidden'
    ]}
  >
    {text}
  </span>
</span>
