import {
  COURSE_TOPICS,
  LESSONS,
  VARIABLE_BASICS_CHALLENGE_IDS,
  getLessonById,
  getLessonsByTopicId,
  getTopicById,
  isLessonAvailable,
  isLessonId,
} from './lessons'
import { CONDITIONAL_CHALLENGE_IDS } from './conditionalChallenges'

describe('two-level course catalog', () => {
  it('orders topics and nests lessons under their owner', () => {
    expect(COURSE_TOPICS.map((topic) => topic.id)).toEqual([
      'variables',
      'conditionals',
      'loops',
      'functions',
      'arrays-and-strings',
      'pointers',
    ])
    expect(getLessonsByTopicId('variables').map((lesson) => lesson.id)).toEqual([
      'variables-basics',
    ])
    expect(getLessonsByTopicId('functions')).toEqual([])
  })

  it('defines the available lessons without locking the for lab', () => {
    expect(LESSONS.filter(isLessonAvailable).map((lesson) => lesson.id)).toEqual([
      'variables-basics',
      'conditionals-if-else',
      'loops-for',
    ])
    expect(getLessonById('variables-basics')).toMatchObject({
      path: '/learn/variables/basics',
      moduleNumber: 1,
      lessonNumber: 1,
      estimatedMinutes: 18,
      requiredChallengeIds: VARIABLE_BASICS_CHALLENGE_IDS,
    })
    expect(getLessonById('loops-for')).toMatchObject({
      path: '/learn/loops/for',
      moduleNumber: 3,
      lessonNumber: 1,
      estimatedMinutes: 25,
      concepts: expect.arrayContaining(['巢狀迴圈']),
      prerequisiteLessonIds: ['variables-basics'],
    })
  })

  it('opens the conditionals lesson with its required challenges', () => {
    const lesson = getLessonById('conditionals-if-else')
    expect(lesson).toMatchObject({
      status: 'available',
      path: '/learn/conditionals/if-else',
      requiredChallengeIds: CONDITIONAL_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('provides safe topic and lesson lookups', () => {
    expect(getTopicById('pointers')?.englishTitle).toBe('Pointers')
    expect(isLessonId('variables-basics')).toBe(true)
    expect(isLessonId('variables')).toBe(false)
    expect(isLessonId(null)).toBe(false)
  })
})
