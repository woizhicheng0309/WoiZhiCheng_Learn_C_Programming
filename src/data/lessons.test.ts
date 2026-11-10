import { SCORE_FILE_CHALLENGE_IDS } from './scoreFileChallenges'
import { INTEGER_PARSING_CHALLENGE_IDS } from './integerParsingChallenges'
import { FILE_CHARACTER_CHALLENGE_IDS } from './fileCharacterChallenges'
import { FILE_READING_CHALLENGE_IDS } from './fileReadingChallenges'
import { REALLOCATION_CHALLENGE_IDS } from './reallocationChallenges'
import { ALLOCATION_CHALLENGE_IDS } from './allocationChallenges'
import { STRUCTURE_POINTER_CHALLENGE_IDS } from './structurePointerChallenges'
import { STRUCTURE_ARRAY_CHALLENGE_IDS } from './structureArrayChallenges'
import { STRUCTURE_CHALLENGE_IDS } from './structureChallenges'
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
import { WHILE_CHALLENGE_IDS } from './whileChallenges'
import { LOOP_CONTROL_CHALLENGE_IDS } from './loopControlChallenges'
import { FUNCTION_CHALLENGE_IDS } from './functionChallenges'
import { ARRAY_CHALLENGE_IDS } from './arrayChallenges'
import { POINTER_CHALLENGE_IDS } from './pointerChallenges'
import { SWAP_CHALLENGE_IDS } from './swapChallenges'
import { TRAVERSAL_CHALLENGE_IDS } from './traversalChallenges'
import { STRING_POINTER_CHALLENGE_IDS } from './stringPointerChallenges'

describe('two-level course catalog', () => {
  it('orders topics and nests lessons under their owner', () => {
    expect(COURSE_TOPICS.map((topic) => topic.id)).toEqual([
      'variables',
      'conditionals',
      'loops',
      'functions',
      'arrays-and-strings',
      'pointers',
      'structures',
      'dynamic-memory',
      'files-and-input',
    ])
    expect(getLessonsByTopicId('variables').map((lesson) => lesson.id)).toEqual([
      'variables-basics',
    ])
    expect(getLessonsByTopicId('loops').map((lesson) => lesson.id)).toEqual([
      'loops-for',
      'loops-while-do-while',
      'loops-break-continue',
    ])
    expect(getLessonsByTopicId('functions').map((lesson) => lesson.id)).toEqual([
      'functions-basics',
      'functions-recursion',
    ])
    expect(getLessonsByTopicId('arrays-and-strings').map((lesson) => lesson.id)).toEqual([
      'arrays-basics',
      'arrays-matrices',
      'arrays-search',
      'arrays-binary-search',
      'arrays-selection-sort',
      'arrays-insertion-sort',
      'arrays-bubble-sort',
      'arrays-string-copy',
      'arrays-string-comparison',
    ])
    expect(getLessonsByTopicId('pointers').map((lesson) => lesson.id)).toEqual([
      'pointers-basics',
      'pointers-swap',
      'pointers-traversal',
      'pointers-strings',
      'pointers-array-parameters',
      'pointers-const',
    ])
    expect(getLessonsByTopicId('structures').map(lesson => lesson.id)).toEqual(['structures-basics', 'structures-arrays', 'structures-pointers'])
    expect(getLessonsByTopicId('dynamic-memory').map(lesson => lesson.id)).toEqual(['memory-allocation', 'memory-reallocation'])
    expect(getLessonsByTopicId('files-and-input').map(lesson => lesson.id)).toEqual(['files-reading', 'files-characters', 'files-integer-parsing', 'files-score-statistics'])
  })

  it('defines the available lessons without locking the for lab', () => {
    expect(LESSONS.filter(isLessonAvailable).map((lesson) => lesson.id)).toEqual([
      'variables-basics',
      'conditionals-if-else',
      'conditionals-switch',
      'loops-for',
      'loops-while-do-while',
      'loops-break-continue',
      'functions-basics',
      'functions-recursion',
      'arrays-basics',
      'arrays-matrices',
      'arrays-search',
      'arrays-binary-search',
      'arrays-selection-sort',
      'arrays-insertion-sort',
      'arrays-bubble-sort',
      'arrays-string-copy',
      'arrays-string-comparison',
      'pointers-basics',
      'pointers-swap',
      'pointers-traversal',
      'pointers-strings',
      'pointers-array-parameters',
      'pointers-const',
      'structures-basics',
      'structures-arrays',
      'structures-pointers',
      'memory-allocation',
      'memory-reallocation',
      'files-reading',
      'files-characters',
      'files-integer-parsing',
      'files-score-statistics',
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

  it('adds while and do-while as the second loops lesson', () => {
    const lesson = getLessonById('loops-while-do-while')
    expect(lesson).toMatchObject({
      topicId: 'loops',
      moduleNumber: 3,
      lessonNumber: 2,
      order: 5,
      title: 'while 與 do…while',
      status: 'available',
      path: '/learn/loops/while-do-while',
      estimatedMinutes: 25,
      prerequisiteLessonIds: ['conditionals-if-else', 'loops-for'],
      requiredChallengeIds: WHILE_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('adds break and continue as the third loops lesson', () => {
    const lesson = getLessonById('loops-break-continue')
    expect(lesson).toMatchObject({
      topicId: 'loops',
      moduleNumber: 3,
      lessonNumber: 3,
      order: 6,
      title: 'break 與 continue',
      status: 'available',
      path: '/learn/loops/break-continue',
      estimatedMinutes: 22,
      prerequisiteLessonIds: ['loops-for', 'loops-while-do-while'],
      requiredChallengeIds: LOOP_CONTROL_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('opens the functions lesson after the loops lessons', () => {
    const lesson = getLessonById('functions-basics')
    expect(lesson).toMatchObject({
      topicId: 'functions',
      moduleNumber: 4,
      lessonNumber: 1,
      order: 7,
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
      order: 9,
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
      order: 18,
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
      order: 19,
      title: '指標參數與交換變數',
      status: 'available',
      path: '/learn/pointers/swap',
      estimatedMinutes: 25,
      prerequisiteLessonIds: ['functions-basics', 'pointers-basics'],
      requiredChallengeIds: SWAP_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('connects arrays and loops in a third pointers lesson', () => {
    const lesson = getLessonById('pointers-traversal')
    expect(lesson).toMatchObject({
      topicId: 'pointers',
      moduleNumber: 6,
      lessonNumber: 3,
      order: 20,
      title: '陣列與指標走訪',
      status: 'available',
      path: '/learn/pointers/traversal',
      estimatedMinutes: 25,
      prerequisiteLessonIds: ['arrays-basics', 'pointers-basics', 'loops-for'],
      requiredChallengeIds: TRAVERSAL_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('connects strings and traversal in a fourth pointers lesson', () => {
    const lesson = getLessonById('pointers-strings')
    expect(lesson).toMatchObject({
      topicId: 'pointers',
      moduleNumber: 6,
      lessonNumber: 4,
      order: 21,
      title: '字串與字元指標',
      status: 'available',
      path: '/learn/pointers/strings',
      estimatedMinutes: 25,
      prerequisiteLessonIds: ['arrays-basics', 'pointers-traversal'],
      requiredChallengeIds: STRING_POINTER_CHALLENGE_IDS,
    })
    expect(lesson && isLessonAvailable(lesson)).toBe(true)
  })

  it('opens chapter seven with a member-access lesson and its own required challenges', () => {
    expect(getTopicById('structures')).toMatchObject({ order: 7, title: '結構與自訂型別' })
    expect(getLessonById('structures-basics')).toMatchObject({
      topicId: 'structures', moduleNumber: 7, lessonNumber: 1, order: 24,
      path: '/learn/structures/basics', status: 'available',
      prerequisiteLessonIds: ['variables-basics', 'arrays-basics'],
      requiredChallengeIds: STRUCTURE_CHALLENGE_IDS,
    })
    expect(isLessonId('structures-basics')).toBe(true)
  })

  it('adds structure arrays with indexing and loop prerequisites', () => {
    expect(getLessonById('structures-arrays')).toMatchObject({
      topicId: 'structures', moduleNumber: 7, lessonNumber: 2, order: 25,
      path: '/learn/structures/arrays', status: 'available',
      prerequisiteLessonIds: ['structures-basics', 'arrays-basics', 'loops-for'],
      requiredChallengeIds: STRUCTURE_ARRAY_CHALLENGE_IDS,
    })
    expect(isLessonId('structures-arrays')).toBe(true)
  })

  it('connects structure member access with pointer and branching prerequisites', () => {
    expect(getLessonById('structures-pointers')).toMatchObject({
      topicId: 'structures', moduleNumber: 7, lessonNumber: 3, order: 26,
      path: '/learn/structures/pointers', status: 'available',
      prerequisiteLessonIds: ['structures-basics', 'pointers-basics', 'conditionals-if-else'],
      requiredChallengeIds: STRUCTURE_POINTER_CHALLENGE_IDS,
    })
    expect(isLessonId('structures-pointers')).toBe(true)
  })

  it('opens chapter eight with dynamic allocation and its own challenges', () => {
    expect(getTopicById('dynamic-memory')).toMatchObject({ order: 8, title: '動態記憶體' })
    expect(getLessonById('memory-allocation')).toMatchObject({
      topicId: 'dynamic-memory', moduleNumber: 8, lessonNumber: 1, order: 27,
      path: '/learn/memory/allocation', status: 'available',
      prerequisiteLessonIds: ['pointers-basics', 'arrays-basics', 'loops-for', 'conditionals-if-else'],
      requiredChallengeIds: ALLOCATION_CHALLENGE_IDS,
    })
    expect(isLessonId('memory-allocation')).toBe(true)
  })

  it('adds reallocation after the allocation lifetime lesson', () => {
    expect(getLessonById('memory-reallocation')).toMatchObject({
      topicId: 'dynamic-memory', moduleNumber: 8, lessonNumber: 2, order: 28,
      path: '/learn/memory/reallocation', status: 'available',
      prerequisiteLessonIds: ['memory-allocation', 'pointers-basics', 'loops-for'],
      requiredChallengeIds: REALLOCATION_CHALLENGE_IDS,
    })
    expect(isLessonId('memory-reallocation')).toBe(true)
  })

  it('opens chapter nine with file input and independent required challenges', () => {
    expect(getTopicById('files-and-input')).toMatchObject({ order: 9, title: '檔案與文字輸入' })
    expect(getLessonById('files-reading')).toMatchObject({
      topicId: 'files-and-input', moduleNumber: 9, lessonNumber: 1, order: 29,
      path: '/learn/files/reading', status: 'available',
      prerequisiteLessonIds: ['arrays-string-copy', 'pointers-basics', 'loops-while-do-while'],
      requiredChallengeIds: FILE_READING_CHALLENGE_IDS,
    })
    expect(isLessonId('files-reading')).toBe(true)
  })

  it('adds character input with explicit EOF and early-stop concepts', () => {
    expect(getLessonById('files-characters')).toMatchObject({
      topicId: 'files-and-input', moduleNumber: 9, lessonNumber: 2, order: 30,
      path: '/learn/files/characters', status: 'available',
      prerequisiteLessonIds: ['files-reading', 'loops-break-continue', 'conditionals-if-else'],
      requiredChallengeIds: FILE_CHARACTER_CHALLENGE_IDS,
    })
    expect(isLessonId('files-characters')).toBe(true)
  })

  it('adds integer parsing with explicit range and complete-input validation', () => {
    expect(getLessonById('files-integer-parsing')).toMatchObject({
      topicId: 'files-and-input', moduleNumber: 9, lessonNumber: 3, order: 31,
      path: '/learn/files/integer-parsing', status: 'available',
      prerequisiteLessonIds: ['files-reading', 'pointers-strings', 'conditionals-if-else'],
      requiredChallengeIds: INTEGER_PARSING_CHALLENGE_IDS,
    })
    expect(isLessonId('files-integer-parsing')).toBe(true)
  })

  it('adds the score file capstone after character reading and number parsing', () => {
    expect(getLessonById('files-score-statistics')).toMatchObject({
      topicId: 'files-and-input', moduleNumber: 9, lessonNumber: 4, order: 32,
      path: '/learn/files/score-statistics', status: 'available',
      prerequisiteLessonIds: ['files-characters', 'files-integer-parsing', 'arrays-basics'],
      requiredChallengeIds: SCORE_FILE_CHALLENGE_IDS,
    })
    expect(isLessonId('files-score-statistics')).toBe(true)
  })

  it('provides safe topic and lesson lookups', () => {
    expect(getTopicById('pointers')?.englishTitle).toBe('Pointers')
    expect(isLessonId('variables-basics')).toBe(true)
    expect(isLessonId('loops-while-do-while')).toBe(true)
    expect(isLessonId('loops-break-continue')).toBe(true)
    expect(isLessonId('functions-basics')).toBe(true)
    expect(isLessonId('arrays-basics')).toBe(true)
    expect(isLessonId('pointers-basics')).toBe(true)
    expect(isLessonId('pointers-swap')).toBe(true)
    expect(isLessonId('pointers-traversal')).toBe(true)
    expect(isLessonId('pointers-strings')).toBe(true)
    expect(isLessonId('variables')).toBe(false)
    expect(isLessonId(null)).toBe(false)
  })
})
