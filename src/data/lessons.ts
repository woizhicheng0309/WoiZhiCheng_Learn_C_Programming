import { CONST_POINTER_CHALLENGE_IDS } from './constPointerChallenges'
import { STRING_COMPARISON_CHALLENGE_IDS } from './stringComparisonChallenges'
import { ARRAY_PARAMETER_CHALLENGE_IDS } from './arrayParameterChallenges'
import { STRING_COPY_CHALLENGE_IDS } from './stringCopyChallenges'
import { BUBBLE_SORT_CHALLENGE_IDS } from './bubbleSortChallenges'
import { INSERTION_SORT_CHALLENGE_IDS } from './insertionSortChallenges'
import { SELECTION_SORT_CHALLENGE_IDS } from './selectionSortChallenges'
import { BINARY_SEARCH_CHALLENGE_IDS } from './binarySearchChallenges'
import { SEARCH_CHALLENGE_IDS } from './searchChallenges'
import { MATRIX_CHALLENGE_IDS } from './matrixChallenges'
import { RECURSION_CHALLENGE_IDS } from './recursionChallenges'
import { SWITCH_CHALLENGE_IDS } from './switchChallenges'
import { CHALLENGE_IDS } from './challenges'
import { VARIABLE_CHALLENGE_IDS } from './variableChallenges'
import { CONDITIONAL_CHALLENGE_IDS } from './conditionalChallenges'
import { FUNCTION_CHALLENGE_IDS } from './functionChallenges'
import { ARRAY_CHALLENGE_IDS } from './arrayChallenges'
import { POINTER_CHALLENGE_IDS } from './pointerChallenges'
import { SWAP_CHALLENGE_IDS } from './swapChallenges'
import { TRAVERSAL_CHALLENGE_IDS } from './traversalChallenges'
import { STRING_POINTER_CHALLENGE_IDS } from './stringPointerChallenges'
import { WHILE_CHALLENGE_IDS } from './whileChallenges'
import { LOOP_CONTROL_CHALLENGE_IDS } from './loopControlChallenges'

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
    id: 'conditionals-switch', topicId: 'conditionals', moduleNumber: 2, lessonNumber: 2, order: 3,
    title: 'switch、case 與 break', englishTitle: 'switch, case & break',
    description: '匹配分支入口，觀察 break、default 與省略 break 後的接續執行。',
    concepts: ['switch', 'case', 'default', 'fall-through'], status: 'available',
    path: '/learn/conditionals/switch', estimatedMinutes: 22,
    prerequisiteLessonIds: ['conditionals-if-else'], requiredChallengeIds: SWITCH_CHALLENGE_IDS,
  },
  {
    id: 'loops-for',
    topicId: 'loops',
    moduleNumber: 3,
    lessonNumber: 1,
    order: 4,
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
    id: 'loops-while-do-while',
    topicId: 'loops',
    moduleNumber: 3,
    lessonNumber: 2,
    order: 5,
    title: 'while 與 do…while',
    englishTitle: 'while & do…while Loops',
    description: '比較條件在執行前或執行後判斷的差別，追蹤更新後的變數，並辨識無窮迴圈風險。',
    concepts: ['while', 'do…while', '先判斷與後判斷', '變數更新與終止'],
    status: 'available',
    path: '/learn/loops/while-do-while',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['conditionals-if-else', 'loops-for'],
    requiredChallengeIds: WHILE_CHALLENGE_IDS,
  },
  {
    id: 'loops-break-continue',
    topicId: 'loops',
    moduleNumber: 3,
    lessonNumber: 3,
    order: 6,
    title: 'break 與 continue',
    englishTitle: 'break & continue',
    description: '比較跳出整個迴圈與跳過本次剩餘步驟，逐步追蹤 for 的更新式、輸出與累加結果。',
    concepts: ['break', 'continue', 'for 更新式', '跳出與跳過'],
    status: 'available',
    path: '/learn/loops/break-continue',
    estimatedMinutes: 22,
    prerequisiteLessonIds: ['loops-for', 'loops-while-do-while'],
    requiredChallengeIds: LOOP_CONTROL_CHALLENGE_IDS,
  },
  {
    id: 'functions-basics',
    topicId: 'functions',
    moduleNumber: 4,
    lessonNumber: 1,
    order: 7,
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
    id: 'functions-recursion',
    topicId: 'functions',
    moduleNumber: 4,
    lessonNumber: 2,
    order: 8,
    title: '遞迴與呼叫堆疊',
    englishTitle: 'Recursion & the Call Stack',
    description: '追蹤階乘的每層呼叫、終止條件與回傳值，理解各層獨立的區域變數。',
    concepts: ['遞迴呼叫', '終止條件', '呼叫堆疊', '逐層回傳'],
    status: 'available',
    path: '/learn/functions/recursion',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['functions-basics', 'conditionals-if-else'],
    requiredChallengeIds: RECURSION_CHALLENGE_IDS,
  },
  {
    id: 'arrays-basics',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 1,
    order: 9,
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
  {
    id: 'arrays-matrices',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 2,
    order: 10,
    title: '二維陣列與巢狀走訪',
    englishTitle: '2D Arrays & Nested Traversal',
    description: '用列欄索引讀取二維陣列，比較逐列與逐欄走訪，以及不變的逐列存放順序。',
    concepts: ['二維陣列', '列欄索引', '巢狀走訪', '逐列記憶體排列'],
    status: 'available',
    path: '/learn/arrays/matrices',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-basics', 'loops-for'],
    requiredChallengeIds: MATRIX_CHALLENGE_IDS,
  },
  {
    id: 'arrays-search',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 3,
    order: 11,
    title: '線性搜尋與提前結束',
    englishTitle: 'Linear Search & Early Exit',
    description: '逐格比較元素，分辨第一筆與最後一筆相符的位置，以及找不到時的狀態標記。',
    concepts: ['線性搜尋', '重複值', '提前結束', '找不到與 -1'],
    status: 'available',
    path: '/learn/arrays/search',
    estimatedMinutes: 22,
    prerequisiteLessonIds: ['arrays-basics', 'loops-break-continue'],
    requiredChallengeIds: SEARCH_CHALLENGE_IDS,
  },
  {
    id: 'arrays-binary-search',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 4,
    order: 12,
    title: '二分搜尋與區間縮小',
    englishTitle: 'Binary Search & Shrinking Intervals',
    description: '在有序陣列中追蹤左右邊界與中點，理解閉區間、邊界更新與空區間終止。',
    concepts: ['二分搜尋', '有序資料', '閉區間', '中點與邊界更新'],
    status: 'available',
    path: '/learn/arrays/binary-search',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-search', 'loops-while-do-while'],
    requiredChallengeIds: BINARY_SEARCH_CHALLENGE_IDS,
  },
  {
    id: 'arrays-selection-sort',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 5,
    order: 13,
    title: '選擇排序與交換',
    englishTitle: 'Selection Sort & Swapping',
    description: '逐輪尋找候選索引並交換，觀察已排序區段、暫存變數與元素比較次數。',
    concepts: ['選擇排序', '候選索引', 'temp 交換', '已排序區段'],
    status: 'available',
    path: '/learn/arrays/selection-sort',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-basics', 'loops-for'],
    requiredChallengeIds: SELECTION_SORT_CHALLENGE_IDS,
  },
  {
    id: 'arrays-insertion-sort',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 6,
    order: 14,
    title: '插入排序與右移',
    englishTitle: 'Insertion Sort & Shifting',
    description: '暫存 key、右移元素並擴大有序前綴，理解短路判斷如何保護陣列邊界。',
    concepts: ['插入排序', 'key 暫存', '元素右移', '短路與邊界'],
    status: 'available',
    path: '/learn/arrays/insertion-sort',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-selection-sort', 'conditionals-if-else'],
    requiredChallengeIds: INSERTION_SORT_CHALLENGE_IDS,
  },
  {
    id: 'arrays-bubble-sort',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 7,
    order: 15,
    title: '氣泡排序與提前結束',
    englishTitle: 'Bubble Sort & Early Exit',
    description: '逐對交換相鄰元素，追蹤右側有序區段，並比較整輪無交換時提前結束的效果。',
    concepts: ['氣泡排序', '相鄰交換', '交換旗標', '提前結束'],
    status: 'available',
    path: '/learn/arrays/bubble-sort',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-selection-sort', 'loops-break-continue'],
    requiredChallengeIds: BUBBLE_SORT_CHALLENGE_IDS,
  },
  {
    id: 'arrays-string-copy',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 8,
    order: 16,
    title: '字串長度與安全複製',
    englishTitle: 'String Length & Safe Copying',
    description: '比較 strlen、陣列大小與容量，逐格複製結尾空字元，並在空間不足時安全拒絕。',
    concepts: ['strlen', 'sizeof 陣列', '結尾空字元', '容量檢查'],
    status: 'available',
    path: '/learn/arrays/string-copy',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-basics', 'loops-for'],
    requiredChallengeIds: STRING_COPY_CHALLENGE_IDS,
  },
  {
    id: 'arrays-string-comparison',
    topicId: 'arrays-and-strings',
    moduleNumber: 5,
    lessonNumber: 9,
    order: 17,
    title: '字串比較與 strcmp',
    englishTitle: 'String Comparison & strcmp',
    description: '逐字比較相同前綴與第一個不同位元組，理解空字元、大小寫與 strcmp 的結果符號。',
    concepts: ['字串內容比較', '相同前綴', 'unsigned char', 'strcmp 符號'],
    status: 'available',
    path: '/learn/arrays/string-comparison',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-string-copy', 'conditionals-if-else'],
    requiredChallengeIds: STRING_COMPARISON_CHALLENGE_IDS,
  },
  {
    id: 'pointers-basics',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 1,
    order: 18,
    title: '指標、位址與間接存取',
    englishTitle: 'Pointers, Addresses & Indirection',
    description: '看見指標如何儲存位址，透過解參照讀寫原變數，並辨識 NULL 存取風險。',
    concepts: ['取址運算子 &', '解參照 *', '間接讀寫', 'NULL 指標'],
    status: 'available',
    path: '/learn/pointers/basics',
    estimatedMinutes: 24,
    prerequisiteLessonIds: ['arrays-basics'],
    requiredChallengeIds: POINTER_CHALLENGE_IDS,
  },
  {
    id: 'pointers-swap',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 2,
    order: 19,
    title: '指標參數與交換變數',
    englishTitle: 'Pointer Parameters & Swapping Variables',
    description: '比較交換區域副本與透過指標改寫原變數，逐步理解參數傳值與暫存變數的作用。',
    concepts: ['參數傳值', '位址的副本', '指標參數', '暫存變數 temp'],
    status: 'available',
    path: '/learn/pointers/swap',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['functions-basics', 'pointers-basics'],
    requiredChallengeIds: SWAP_CHALLENGE_IDS,
  },
  {
    id: 'pointers-traversal',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 3,
    order: 20,
    title: '陣列與指標走訪',
    englishTitle: 'Arrays & Pointer Traversal',
    description: '比較索引與指標如何走過同一組陣列，理解指標步進，以及陣列尾端位址能形成但不能讀取的界線。',
    concepts: ['陣列索引與解參照', '指標步進', '逐項走訪', '尾端下一格位址'],
    status: 'available',
    path: '/learn/pointers/traversal',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-basics', 'pointers-basics', 'loops-for'],
    requiredChallengeIds: TRAVERSAL_CHALLENGE_IDS,
  },
  {
    id: 'pointers-strings',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 4,
    order: 21,
    title: '字串與字元指標',
    englishTitle: 'Strings & Character Pointers',
    description: '逐字走訪字元陣列，分辨字元 0 與空字元，觀察內嵌結尾字元如何影響輸出與長度。',
    concepts: ['char 指標', '字串結尾空字元', '字元 0 與空字元', '逐字計算長度'],
    status: 'available',
    path: '/learn/pointers/strings',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['arrays-basics', 'pointers-traversal'],
    requiredChallengeIds: STRING_POINTER_CHALLENGE_IDS,
  },
  {
    id: 'pointers-array-parameters',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 5,
    order: 22,
    title: '陣列作為函式參數',
    englishTitle: 'Arrays as Function Parameters',
    description: '傳入起始位址與元素數量，追蹤唯讀加總、原地修改，以及呼叫端與函式的不同變數。',
    concepts: ['陣列參數', '共用原陣列', '明確傳入數量', 'const 唯讀參數'],
    status: 'available',
    path: '/learn/pointers/array-parameters',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['functions-basics', 'arrays-basics', 'pointers-basics'],
    requiredChallengeIds: ARRAY_PARAMETER_CHALLENGE_IDS,
  },
  {
    id: 'pointers-const',
    topicId: 'pointers',
    moduleNumber: 6,
    lessonNumber: 6,
    order: 23,
    title: '指標與 const',
    englishTitle: 'Pointers & const',
    description: '比較指向唯讀資料與固定指標，區分編譯限制、合法改值、改指向及原變數的直接修改。',
    concepts: ['const int *p', 'int *const p', '編譯階段限制', '原變數與別名'],
    status: 'available',
    path: '/learn/pointers/const',
    estimatedMinutes: 25,
    prerequisiteLessonIds: ['pointers-basics', 'pointers-array-parameters'],
    requiredChallengeIds: CONST_POINTER_CHALLENGE_IDS,
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
