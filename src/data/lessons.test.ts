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
import { FUNCTION_CHALLENGE_IDS } from './functionChallenges'
import { ARRAY_CHALLENGE_IDS } from './arrayChallenges'
import { POINTER_CHALLENGE_IDS } from './pointerChallenges'
import { SWAP_CHALLENGE_IDS } from './swapChallenges'

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
    expect(getLessonsByTopicId('functions').map((lesson) => lesson.id)).toEqual([
      'functions-basics',
    ])
    expect(getLessonsByTopicId('arrays-and-strings').map((lesson) => lesson.id)).toEqual([
      'arrays-basics',
    ])
    expect(getLessonsByTopicId('pointers').map((lesson) => lesson.id)).toEqual([
      'pointers-basics',
      'pointers-swap',
    ])
  })

  it('defines the available lessons without locking the for lab', () => {
    expect(LESSONS.filter(isLessonAvailable).map((lesson) => lesson.id)).toEqual([
      'variables-basics',
      'conditionals-if-else',
      'loops-for',
      'functions-basics',
      'arrays-basics',
      'pointers-basics',
      'pointers-swap',
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

  it('opens the functions lesson after the for-loop lesson', () => {
    const lesson = getLessonById('functions-basics')
    expect(lesson).toMatchObject({
      topicId: 'functions',
      moduleNumber: 4,
      lessonNumber: 1,
      order: 4,
      title: '函式、參數與回傳值',
      status: 'available',
      path: '/learn/functions/basics',
      prerequisiteLessonIds: ['loops-for'],
      requiredChallengeIds: FUNCTION_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('opens the arrays lesson after functions with three required challenges', () => {
    const lesson = getLessonById('arrays-basics')
    expect(lesson).toMatchObject({
      topicId: 'arrays-and-strings',
      moduleNumber: 5,
      lessonNumber: 1,
      order: 5,
      title: '陣列、索引與字串',
      status: 'available',
      path: '/learn/arrays/basics',
      estimatedMinutes: 24,
      prerequisiteLessonIds: ['functions-basics'],
      requiredChallengeIds: ARRAY_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('opens pointers after arrays with three required challenges', () => {
    const lesson = getLessonById('pointers-basics')
    expect(lesson).toMatchObject({
      topicId: 'pointers',
      moduleNumber: 6,
      lessonNumber: 1,
      order: 6,
      title: '指標、位址與間接存取',
      status: 'available',
      path: '/learn/pointers/basics',
      estimatedMinutes: 24,
      prerequisiteLessonIds: ['arrays-basics'],
      requiredChallengeIds: POINTER_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('connects functions and pointers in a second pointers lesson', () => {
    const lesson = getLessonById('pointers-swap')
    expect(lesson).toMatchObject({
      topicId: 'pointers',
      moduleNumber: 6,
      lessonNumber: 2,
      order: 7,
      title: '指標參數與交換變數',
      status: 'available',
      path: '/learn/pointers/swap',
      estimatedMinutes: 25,
      prerequisiteLessonIds: ['functions-basics', 'pointers-basics'],
      requiredChallengeIds: SWAP_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('provides safe topic and lesson lookups', () => {
    expect(getTopicById('pointers')?.englishTitle).toBe('Pointers')
    expect(isLessonId('variables-basics')).toBe(true)
    expect(isLessonId('functions-basics')).toBe(true)
    expect(isLessonId('arrays-basics')).toBe(true)
    expect(isLessonId('pointers-basics')).toBe(true)
    expect(isLessonId('pointers-swap')).toBe(true)
    expect(isLessonId('variables')).toBe(false)
    expect(isLessonId(null)).toBe(false)
  })
})
