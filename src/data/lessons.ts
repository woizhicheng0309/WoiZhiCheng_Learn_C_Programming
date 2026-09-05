import { CHALLENGE_IDS } from './challenges'
import { VARIABLE_CHALLENGE_IDS } from './variableChallenges'
import { CONDITIONAL_CHALLENGE_IDS } from './conditionalChallenges'
import { FUNCTION_CHALLENGE_IDS } from './functionChallenges'
import { ARRAY_CHALLENGE_IDS } from './arrayChallenges'

export const TOPIC_IDS = [
  'variables',
  'conditionals',
  'loops',
  'functions',
  'arrays-and-strings',
  'pointers',
] as const

export type TopicId = (typeof TOPIC_IDS)[number]

export const LESSON_IDS = [
  'variables-basics',
  'conditionals-if-else',
  'loops-for',
  'functions-basics',
  'arrays-basics',
] as const

export type LessonId = (typeof LESSON_IDS)[number]
export type LessonAvailability = 'available' | 'coming-soon'
export type LessonProgressStatus = 'not-started' | 'in-progress' | 'completed'

export const VARIABLE_BASICS_CHALLENGE_IDS = VARIABLE_CHALLENGE_IDS

export type VariableBasicsChallengeId =
  (typeof VARIABLE_BASICS_CHALLENGE_IDS)[number]

export interface LessonDefinition {
  id: LessonId
  topicId: TopicId
  moduleNumber: number
  lessonNumber: number
  order: number
  title: string
  englishTitle: string
  description: string
  concepts: readonly string[]
  status: LessonAvailability
  path: string | null
  estimatedMinutes: number
  prerequisiteLessonIds: readonly LessonId[]
  requiredChallengeIds: readonly string[]
}

export interface TopicDefinition {
  id: TopicId
  order: number
  title: string
  englishTitle: string
  description: string
  lessons: readonly LessonDefinition[]
}

const lessons: readonly LessonDefinition[] = [
  {
    id: 'variables-basics',
    topicId: 'variables',
    moduleNumber: 1,
    lessonNumber: 1,
    order: 1,
    title: '程式骨架、變數與運算',
    englishTitle: 'Program Structure, Variables & Operations',
    description: '從 main 函式出發，用記憶盒理解宣告、賦值與算式運算。',
    concepts: ['main 函式', '資料型別', '宣告與賦值', '算術運算'],
    status: 'available',
    path: '/learn/variables/basics',
    estimatedMinutes: 18,
    prerequisiteLessonIds: [],
    requiredChallengeIds: VARIABLE_BASICS_CHALLENGE_IDS,
  },
  {
    id: 'conditionals-if-else',
    topicId: 'conditionals',
    moduleNumber: 2,
    lessonNumber: 1,
    order: 2,
    title: 'if 與 else',
    englishTitle: 'if & else',
    description: '用條件讓程式做選擇，理解比較、邏輯運算與不同分支何時執行。',
    concepts: ['if', 'else', '比較運算子', '&& / ||'],
    status: 'available',
    path: '/learn/conditionals/if-else',
    estimatedMinutes: 20,
    prerequisiteLessonIds: ['variables-basics'],
    requiredChallengeIds: CONDITIONAL_CHALLENGE_IDS,
  },
  {
    id: 'loops-for',
    topicId: 'loops',
    moduleNumber: 3,
    lessonNumber: 1,
    order: 3,
    title: 'for 迴圈',
    englishTitle: 'for Loop',
    description: '調整 for 迴圈參數，逐步觀察單層流程，再用乘法表理解巢狀迴圈。',
    concepts: ['for 迴圈', '終止條件', '步進值', '巢狀迴圈'],
    status: 'available',
    path: '/learn/loops/for',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['variables-basics'],
    requiredChallengeIds: CHALLENGE_IDS,
  },
  {
    id: 'functions-basics',
    topicId: 'functions',
    moduleNumber: 4,
    lessonNumber: 1,
    order: 4,
    title: '函式、參數與回傳值',
    englishTitle: 'Functions, Parameters & Return Values',
    description: '把重複工作封裝成函式，追蹤引數如何傳入參數，以及回傳值如何回到呼叫端。',
    concepts: ['函式宣告', '參數與引數', '回傳值', '區域變數'],
    status: 'available',
    path: '/learn/functions/basics',
    estimatedMinutes: 22,
    prerequisiteLessonIds: ['loops-for'],
    requiredChallengeIds: FUNCTION_CHALLENGE_IDS,
  },
  {
    id: 'arrays-basics',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 1,
    order: 5,
    title: '陣列、索引與字串',
    englishTitle: 'Arrays, Indexes & Strings',
    description: '用連續記憶格理解陣列索引、元素讀寫與越界風險，再看懂字串結尾的空字元。',
    concepts: ['陣列宣告', '索引讀寫', '越界存取', "字串與 '\\0'"],
    status: 'available',
    path: '/learn/arrays/basics',
    estimatedMinutes: 24,
    prerequisiteLessonIds: ['functions-basics'],
    requiredChallengeIds: ARRAY_CHALLENGE_IDS,
  },
]

const topicMetadata: ReadonlyArray<Omit<TopicDefinition, 'lessons'>> = [
  {
    id: 'variables',
    order: 1,
    title: '變數與運算',
    englishTitle: 'Variables & Operations',
    description: '認識程式骨架、資料型別、命名、賦值與算術運算。',
  },
  {
    id: 'conditionals',
    order: 2,
    title: '條件判斷',
    englishTitle: 'Conditionals',
    description: '用條件讓程式做選擇，建立分支執行的基礎直覺。',
  },
  {
    id: 'loops',
    order: 3,
    title: '迴圈',
    englishTitle: 'Loops',
    description: '重複執行一段程式，觀察條件與變數如何共同控制流程。',
  },
  {
    id: 'functions',
    order: 4,
    title: '函式',
    englishTitle: 'Functions',
    description: '把工作拆成可重複使用的單元，理解參數與回傳值。',
  },
  {
    id: 'arrays-and-strings',
    order: 5,
    title: '陣列與字串',
    englishTitle: 'Arrays & Strings',
    description: '用連續空間整理多筆資料，學習索引與字元序列。',
  },
  {
    id: 'pointers',
    order: 6,
    title: '指標',
    englishTitle: 'Pointers',
    description: '從記憶體位址出發，建立 C 語言指標的基礎直覺。',
  },
]

/** Ordered, two-level course catalog used by the learning map. */
export const COURSE_TOPICS: readonly TopicDefinition[] = topicMetadata.map(
  (topic) => ({
    ...topic,
    lessons: lessons.filter((lesson) => lesson.topicId === topic.id),
  }),
)

/** Flat index for lookups and progress calculations. */
export const LESSONS: readonly LessonDefinition[] = COURSE_TOPICS.flatMap(
  (topic) => topic.lessons,
)

const lessonsById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]))
const topicsById = new Map(COURSE_TOPICS.map((topic) => [topic.id, topic]))

export function isLessonId(value: unknown): value is LessonId {
  return typeof value === 'string' && LESSON_IDS.includes(value as LessonId)
}

export function getLessonById(id: LessonId): LessonDefinition | undefined {
  return lessonsById.get(id)
}

export function getTopicById(id: TopicId): TopicDefinition | undefined {
  return topicsById.get(id)
}

export function getLessonsByTopicId(
  topicId: TopicId,
): readonly LessonDefinition[] {
  return topicsById.get(topicId)?.lessons ?? []
}

export function isLessonAvailable(
  lesson: LessonDefinition,
): lesson is LessonDefinition & { status: 'available'; path: string } {
  return lesson.status === 'available' && lesson.path !== null
}
