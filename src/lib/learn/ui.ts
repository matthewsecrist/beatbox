// Shared classes for the lessons' controls.
export const button =
  'flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50'

export const chip = (on: boolean): string[] => [
  'rounded-md border px-2.5 py-1 text-sm font-medium transition active:scale-95',
  on
    ? 'border-amber-400 bg-amber-400/15 text-amber-200'
    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
]

export const select =
  'rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none'

export const panel = 'space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:p-4'
