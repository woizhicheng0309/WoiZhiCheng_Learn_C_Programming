import { LESSONS, getLessonById, isLessonAvailable } from './lessons'

describe('course catalog', () => {
  it('lists the six course topics in teaching order', () => {
    expect(LESSONS.map((lesson) => lesson.title)).toEqual([
      '變數與運算',
      '條件判斷',
      '迴圈',
      '函式',
      '陣列與字串',
      '指標',
    ])
    expect(LESSONS.map((lesson) => lesson.order)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('enables the first three interactive lesson routes', () => {
    const available = LESSONS.filter(isLessonAvailable)

    expect(available.map((lesson) => [lesson.id, lesson.path])).toEqual([
      ['variables', '/learn/variables'],
      ['conditionals', '/learn/conditionals'],
      ['loops', '/learn/loops/for'],
    ])
    expect(
      LESSONS.filter((lesson) => lesson.status === 'coming-soon').every(
        (lesson) => lesson.path === null,
      ),
    ).toBe(true)
  })

  it('finds a lesson by its stable id', () => {
    expect(getLessonById('pointers')?.englishTitle).toBe('Pointers')
  })
})
