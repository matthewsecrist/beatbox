import { getLesson, LESSONS } from '$lib/learn/lessons.js'
import { error } from '@sveltejs/kit'

import type { PageLoad } from './$types'

export const load = (({ params }) => {
  const index = LESSONS.findIndex((l) => l.slug === params.slug)
  const lesson = getLesson(params.slug)
  if (!lesson) error(404, 'No such lesson')
  return {
    lesson,
    next: LESSONS[index + 1] ?? null,
    number: index + 1,
    previous: LESSONS[index - 1] ?? null
  }
}) satisfies PageLoad
