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

  it('defines the next two available lessons without locking the for lab', () => {
    expect(LESSONS.filter(isLessonAvailable).map((lesson) => lesson.id)).toEqual([
      'variables-basics',
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
      prerequisiteLessonIds: ['variables-basics'],
    })
  })

  it('keeps coming-soon lessons non-navigable', () => {
    const lesson = getLessonById('conditionals-if-else')
    expect(lesson).toMatchObject({ status: 'coming-soon', path: null })
    expect(lesson && isLessonAvailable(lesson)).toBe(false)
  })

  it('provides safe topic and lesson lookups', () => {
    expect(getTopicById('pointers')?.englishTitle).toBe('Pointers')
    expect(isLessonId('variables-basics')).toBe(true)
    expect(isLessonId('variables')).toBe(false)
    expect(isLessonId(null)).toBe(false)
  })
})
