import { LESSONS, getLessonById, isLessonAvailable } from './lessons'

describe('course catalog', () => {
  it('lists the six MVP topics in teaching order', () => {
    expect(LESSONS.map((lesson) => lesson.title)).toEqual([
      '變數',
      '條件判斷',
      '迴圈',
      '函式',
      '陣列與字串',
      '指標',
    ])
    expect(LESSONS.map((lesson) => lesson.order)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('only enables the for-loop lesson route', () => {
    const available = LESSONS.filter(isLessonAvailable)

    expect(available).toHaveLength(1)
    expect(available[0]).toMatchObject({
      id: 'loops',
      status: 'available',
      path: '/learn/loops/for',
    })
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
