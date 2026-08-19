export type LessonId =
  | 'variables'
  | 'conditionals'
  | 'loops'
  | 'functions'
  | 'arrays-and-strings'
  | 'pointers'

export type LessonStatus = 'available' | 'coming-soon'

export interface LessonDefinition {
  id: LessonId
  order: number
  title: string
  englishTitle: string
  description: string
  topics: readonly string[]
  status: LessonStatus
  path: string | null
}

/**
 * The ordered course map displayed on the learning page.
 *
 * A null path is intentional: coming-soon cards must not navigate to an empty
 * lesson page. The loops card is the only lesson available in the MVP.
 */
export const LESSONS: readonly LessonDefinition[] = [
  {
    id: 'variables',
    order: 1,
    title: '變數',
    englishTitle: 'Variables',
    description: '認識資料型別、命名與賦值，學會把資料存進程式。',
    topics: ['資料型別', '宣告', '賦值'],
    status: 'coming-soon',
    path: null,
  },
  {
    id: 'conditionals',
    order: 2,
    title: '條件判斷',
    englishTitle: 'Conditionals',
    description: '用條件讓程式做選擇，理解不同分支何時執行。',
    topics: ['if', 'else', '比較運算子'],
    status: 'coming-soon',
    path: null,
  },
  {
    id: 'loops',
    order: 3,
    title: '迴圈',
    englishTitle: 'Loops',
    description: '調整 for 迴圈參數，逐步觀察條件、輸出與變數的變化。',
    topics: ['for 迴圈', '終止條件', '步進值'],
    status: 'available',
    path: '/learn/loops/for',
  },
  {
    id: 'functions',
    order: 4,
    title: '函式',
    englishTitle: 'Functions',
    description: '把工作拆成可重複使用的單元，理解參數與回傳值。',
    topics: ['參數', '回傳值', '作用域'],
    status: 'coming-soon',
    path: null,
  },
  {
    id: 'arrays-and-strings',
    order: 5,
    title: '陣列與字串',
    englishTitle: 'Arrays & Strings',
    description: '用連續空間整理多筆資料，學習索引與字元序列。',
    topics: ['陣列', '索引', '字串'],
    status: 'coming-soon',
    path: null,
  },
  {
    id: 'pointers',
    order: 6,
    title: '指標',
    englishTitle: 'Pointers',
    description: '從記憶體位址出發，建立 C 語言指標的基礎直覺。',
    topics: ['位址', '取值', '記憶體'],
    status: 'coming-soon',
    path: null,
  },
]

export function getLessonById(id: LessonId): LessonDefinition | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

export function isLessonAvailable(
  lesson: LessonDefinition,
): lesson is LessonDefinition & { status: 'available'; path: string } {
  return lesson.status === 'available' && lesson.path !== null
}
