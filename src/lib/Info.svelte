<script lang="ts">
  import { Info } from '@lucide/svelte'

  // A small ⓘ that explains a control in plain words. The bubble shows while the
  // mouse is over it, on keyboard focus, and on a tap (touch screens have no
  // hover); a second tap, Escape or moving focus away hides it.
  let { label, text }: { label: string; text: string } = $props()
  const id = $props.id()
  let hovered = $state(false)
  let open = $state(false)
  // Placed against the window (fixed), so a scrolling or clipped container (a
  // section card) can't cut it off. Near the right edge it opens to the left.
  let pos = $state({ left: 0, top: 0 })
  let wrapper: HTMLSpanElement | undefined = $state()

  const WIDTH = 240 // px: the bubble's width (w-60)
  const GAP = 6 // px below the ⓘ (like mt-1.5)

  function place() {
    const box = wrapper?.getBoundingClientRect()
    if (!box) return
    const flip = box.left + WIDTH + 8 > document.documentElement.clientWidth
    pos = { left: Math.max(8, flip ? box.right - WIDTH : box.left), top: box.bottom + GAP }
  }
</script>

<!-- Any scroll (the page, or a container like the sections) moves the ⓘ. -->
<svelte:window
  onscrollcapture={() => (open || hovered) && place()}
  onresize={() => (open || hovered) && place()}
/>

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
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    class={[
      'pointer-events-none fixed z-50 w-60 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-left text-xs leading-relaxed font-normal text-zinc-200 shadow-xl shadow-black/60',
      open || hovered ? 'block' : 'hidden'
    ]}
  >
    {text}
  </span>
</span>
