import { DEFAULT_STRING_COPY_CONFIG, simulateStringCopyProgram } from '../domain/stringCopy'
export const STRING_COPY_CHALLENGE_IDS = ['count-copy-characters', 'reserve-string-terminator', 'compare-string-length-size'] as const
export type StringCopyChallengeId = (typeof STRING_COPY_CHALLENGE_IDS)[number]
export const STRING_COPY_CHALLENGES = [
  { id: 'count-copy-characters' as const, title: '結尾也要複製', question: '把 "CODE" 安全複製到容量 5 的 destination，共需要寫入幾格？請包含結尾空字元。' },
  { id: 'reserve-string-terminator' as const, title: '四個字元要幾格？', question: '內容長度是 4 的 "CODE"，目的 char 陣列至少需要幾格，才能形成完整的 C 字串？' },
  { id: 'compare-string-length-size' as const, title: '長度與陣列大小不同', question: 'char source[] = "CO\\0DE"; strlen(source) 與 sizeof source 分別是多少？依序輸入兩個整數。' },
]
export function evaluateStringCopyChallenge(id: StringCopyChallengeId, answer: string) {
  const run = simulateStringCopyProgram({ ...DEFAULT_STRING_COPY_CONFIG, sample: id === 'compare-string-length-size' ? 'embedded-nul' : 'word' })
  const expected = id === 'compare-string-length-size' ? [run.length!, run.sourceSize!] : [run.length! + 1]
  const tokens = answer.trim().split(/[\s,，]+/)
  const solved = tokens.length === expected.length && tokens.every((token, index) => /^\d+$/.test(token) && Number(token) === expected[index])
  const hints = {
    'count-copy-characters': "C、O、D、E 之外，還要複製 '\\0'，總共 5 格。",
    'reserve-string-terminator': '容量至少是長度加 1，也就是 5；容量 4 雖放得下內容，卻沒有位置存放結尾空字元。',
    'compare-string-length-size': "strlen 在內嵌的 '\\0' 停止，長度是 2；陣列仍保存 C、O、空字元、D、E、隱含結尾空字元，共 6 格。",
  }
  return { solved, message: `${solved ? '答對了！' : '再檢查一次：'}${hints[id]}` }
}
