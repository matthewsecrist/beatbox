import { describe, expect, it } from 'vitest'

import { getLesson, LESSONS } from './lessons.js'

describe('lessons', () => {
  it('have unique slugs and can be looked up', () => {
    const slugs = LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(getLesson(slug)?.slug).toBe(slug)
    expect(getLesson('nope')).toBeUndefined()
  })

  it('come in parts, in order: the basics, reading, then making music', () => {
    const order = ['basics', 'reading', 'making']
    const parts = LESSONS.map((l) => order.indexOf(l.part))
    expect(parts).toStrictEqual([...parts].sort((a, b) => a - b))
    expect(new Set(parts).size).toBe(order.length)
  })

  it('each end with a quiz whose answers are among its choices', () => {
    for (const lesson of LESSONS) {
      const quiz = lesson.blocks.at(-1)
      expect(quiz?.kind, lesson.slug).toBe('quiz')
      if (quiz?.kind !== 'quiz') continue
      const questions = quiz.questions()
      expect(questions.length).toBeGreaterThanOrEqual(4)
      for (const q of questions) expect(q.choices, q.prompt).toContain(q.answer)
    }
  })

  it('give every beat-building goal a target on the grid', () => {
    const goals = LESSONS.flatMap((l) => l.blocks).filter((b) => b.kind === 'rhythm')
    expect(goals.length).toBeGreaterThan(0)
    for (const goal of goals) {
      for (const steps of Object.values(goal.target)) {
        expect(steps.every((s) => s >= 0 && s < 16)).toBe(true)
      }
    }
  })
})
