// Euclidean rhythms: `hits` spread as evenly as possible over a cycle of `steps`,
// by Bjorklund's algorithm (as in Toussaint, "The Euclidean Algorithm Generates
// Traditional Musical Rhythms"): 3 over 8 is the tresillo `x..x..x.`, 5 over 8
// the cinquillo `x.xx.xx.`. `rotation` moves the hits that many steps later, and
// the cycle repeats to fill `length` steps (cut short if it doesn't divide it).
export function euclid(hits: number, steps: number, rotation = 0, length = steps): boolean[] {
  const cycle = bjorklund(Math.min(Math.max(hits, 0), steps), steps)
  return Array.from(
    { length },
    (_, i) => cycle[(((i - rotation) % steps) + steps) % steps] ?? false
  )
}

// Starts with one group per hit and one per rest, then keeps appending the
// leftover groups onto the front ones until at most one is left over.
function bjorklund(hits: number, steps: number): boolean[] {
  let front: boolean[][] = Array.from({ length: hits }, () => [true])
  let rest: boolean[][] = Array.from({ length: steps - hits }, () => [false])
  while (rest.length > 1 && front.length > 0) {
    const pairs = Math.min(front.length, rest.length)
    const joined = front.slice(0, pairs).map((group, i) => [...group, ...(rest[i] ?? [])])
    rest = front.length > pairs ? front.slice(pairs) : rest.slice(pairs)
    front = joined
  }
  return [...front, ...rest].flat()
}
