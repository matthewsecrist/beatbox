// One AudioContext for the whole page: every instrument schedules against the same
// clock (separate contexts drift apart), and browsers cap how many can exist.
// Created lazily because browsers only allow audio after a user gesture.
let ctx = null

export function getContext() {
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}
