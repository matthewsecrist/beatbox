<script lang="ts">
  import {
    type Clef,
    countLabel,
    KEY_SIGS,
    type KeySig,
    layout,
    ledgerLines,
    noteShape,
    spell,
    type StaffNote,
    staffPosition,
    writtenName
  } from './notation.js'

  // One line of sheet music, drawn in SVG (no music font needed): the clef, key
  // signature, an optional 4/4, then the notes and rests with bar lines.
  // `highlight` marks the note being played (amber) and `miss` a wrong guess
  // (red); `labels` writes each note's name or its count underneath.
  let {
    clef,
    highlight = -1,
    id,
    key = 'C',
    labels,
    miss = -1,
    notes,
    time = false
  }: {
    clef: Clef
    highlight?: number
    id?: string
    key?: KeySig
    labels?: 'counts' | 'names' | null
    miss?: number
    notes: StaffNote[]
    time?: boolean
  } = $props()

  const TOP = 40 // the top line's y; the lines are 10 apart
  const y = (position: number) => TOP + 40 - position * 5
  const sig = $derived(KEY_SIGS[key])
  const sigEnd = $derived(38 + sig.places[clef].length * 10)
  const x0 = $derived(sigEnd + (time ? 26 : 4))
  const lines = $derived(layout(notes, x0))
  const height = $derived(labels ? 132 : 120)
</script>

<svg
  {id}
  viewBox={`0 0 ${lines.width} ${height}`}
  class="h-auto w-full rounded-lg bg-zinc-50 text-zinc-900"
  style:max-width={`${lines.width * 1.25}px`}
  role="img"
  aria-label={`${clef} clef: ${notes.map((n) => (n.midi === undefined ? 'rest' : writtenName(n.midi, key))).join(', ')}`}
>
  {#each [0, 2, 4, 6, 8] as line (line)}
    <line
      x1="2"
      x2={lines.width - 6}
      y1={y(line)}
      y2={y(line)}
      stroke="currentColor"
      stroke-width="1"
    />
  {/each}

  <!-- Clef -->
  {#if clef === 'treble'}
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.4">
      <path
        d="M13 94 L17 30 C25 24 25 42 12 53 C3 60 4 77 16 78 C26 79 28 65 18 64 C12 63 10 70 16 72"
      />
      <path d="M13 94 C12 99 5 98 7 93" />
    </g>
    <circle cx="8.5" cy="93.5" r="2.6" fill="currentColor" />
  {:else}
    <path
      d="M7 50 C6 39 27 37 27 52 C27 64 17 72 5 78"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="2.6"
    />
    <circle cx="8" cy="50" r="3.4" fill="currentColor" />
    <circle cx="32" cy="45" r="1.8" fill="currentColor" />
    <circle cx="32" cy="55" r="1.8" fill="currentColor" />
  {/if}

  <!-- Key signature -->
  {#each sig.places[clef] as place, i (i)}
    <text x={40 + i * 10} y={y(place) + 5} font-size="17" fill="currentColor" text-anchor="middle"
      >{sig.flat ? '♭' : '♯'}</text
    >
  {/each}

  <!-- Time signature -->
  {#if time}
    {#each [58, 78] as ty (ty)}
      <text
        x={sigEnd + 10}
        y={ty}
        font-size="21"
        font-weight="800"
        font-family="Georgia, serif"
        fill="currentColor"
        text-anchor="middle">4</text
      >
    {/each}
  {/if}

  {#each lines.notes as { beat, index, note, x } (index)}
    {@const shape = noteShape(note.beats)}
    {#if index === highlight || index === miss}
      <rect
        x={x - 13}
        y="16"
        width="26"
        height="96"
        rx="5"
        class={index === miss ? 'fill-red-400/40' : 'fill-amber-300/60'}
      />
    {/if}
    {#if note.midi === undefined}
      <!-- Rest -->
      {#if shape.base === 4}
        <rect x={x - 6} y={y(6)} width="12" height="5" fill="currentColor" />
      {:else if shape.base === 2}
        <rect x={x - 6} y={y(4) - 5} width="12" height="5" fill="currentColor" />
      {:else if shape.base === 1}
        <path
          d={`M${x - 2} ${y(7)} l5 7 l-5 6 l5 7 c-6 -2 -7 5 -1 8`}
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      {:else}
        {#each { length: shape.flags }, f (f)}
          <circle cx={x - 3 - f * 2} cy={y(5) + 2 + f * 8} r="2.3" fill="currentColor" />
          <path
            d={`M${x - 3 - f * 2} ${y(5) + 3 + f * 8} q4 2 7 -3`}
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
        {/each}
        <line x1={x + 4} y1={y(5)} x2={x - 1} y2={y(1)} stroke="currentColor" stroke-width="1.6" />
      {/if}
      {#if shape.dot}
        <circle cx={x + 10} cy={y(5)} r="1.8" fill="currentColor" />
      {/if}
    {:else}
      {@const position = staffPosition(note.midi, clef, key)}
      {@const ny = y(position)}
      {@const up = position < 4}
      {@const accidental = spell(note.midi, key).accidental}
      {#each ledgerLines(position) as ledger (ledger)}
        <line
          x1={x - 10}
          x2={x + 10}
          y1={y(ledger)}
          y2={y(ledger)}
          stroke="currentColor"
          stroke-width="1.2"
        />
      {/each}
      {#if accidental}
        <text x={x - 15} y={ny + 5} font-size="16" fill="currentColor" text-anchor="middle"
          >{accidental}</text
        >
      {/if}
      <ellipse
        cx={x}
        cy={ny}
        rx={shape.base === 4 ? 6.6 : 5.6}
        ry="4.1"
        transform={`rotate(-20 ${x} ${ny})`}
        fill={shape.hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        stroke-width={shape.hollow ? (shape.base === 4 ? 2.2 : 1.6) : 0}
      />
      {#if shape.stem}
        {@const sx = up ? x + 5.2 : x - 5.2}
        {@const end = up ? ny - 32 : ny + 32}
        <line x1={sx} x2={sx} y1={ny} y2={end} stroke="currentColor" stroke-width="1.4" />
        {#each { length: shape.flags }, f (f)}
          <path
            d={up
              ? `M${sx} ${end + f * 7} c2 6 10 8 7 18`
              : `M${sx} ${end - f * 7} c2 -6 10 -8 7 -18`}
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
        {/each}
      {/if}
      {#if shape.dot}
        <circle cx={x + 10} cy={position % 2 === 0 ? ny - 4 : ny} r="1.8" fill="currentColor" />
      {/if}
    {/if}
    {#if labels}
      <text
        {x}
        y="126"
        font-size="11"
        font-weight="600"
        class={labels === 'counts' && /\d/.exec(countLabel(beat))
          ? 'fill-zinc-900'
          : 'fill-zinc-500'}
        text-anchor="middle"
        >{labels === 'counts'
          ? countLabel(beat)
          : note.midi === undefined
            ? ''
            : writtenName(note.midi, key)}</text
      >
    {/if}
  {/each}

  {#each lines.bars as bx, i (i)}
    <line
      x1={bx}
      x2={bx}
      y1={y(8)}
      y2={y(0)}
      stroke="currentColor"
      stroke-width={i === lines.bars.length - 1 ? 2 : 1}
    />
  {/each}
</svg>
