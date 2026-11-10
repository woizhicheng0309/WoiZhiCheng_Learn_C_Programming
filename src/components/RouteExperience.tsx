import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_TITLE = '魏志成的程式設計基礎學習網站'

const routeTitles: Record<string, string> = {
  '/': SITE_TITLE,
  '/learn': `課程地圖｜${SITE_TITLE}`,
  '/learn/variables/basics': `程式骨架、變數與運算｜${SITE_TITLE}`,
  '/learn/conditionals/if-else': `if 與 else｜${SITE_TITLE}`,
  '/learn/conditionals/switch': `switch、case 與 break｜${SITE_TITLE}`,
  '/learn/loops/for': `for 迴圈實驗室｜${SITE_TITLE}`,
  '/learn/loops/while-do-while': `while 與 do…while｜${SITE_TITLE}`,
  '/learn/loops/break-continue': `break 與 continue｜${SITE_TITLE}`,
  '/learn/functions/basics': `函式、參數與回傳值｜${SITE_TITLE}`,
  '/learn/functions/recursion': `遞迴與呼叫堆疊｜${SITE_TITLE}`,
  '/learn/arrays/basics': `陣列、索引與字串｜${SITE_TITLE}`,
  '/learn/arrays/matrices': `二維陣列與巢狀走訪｜${SITE_TITLE}`,
  '/learn/arrays/search': `線性搜尋與提前結束｜${SITE_TITLE}`,
  '/learn/arrays/binary-search': `二分搜尋與區間縮小｜${SITE_TITLE}`,
  '/learn/arrays/selection-sort': `選擇排序與交換｜${SITE_TITLE}`,
  '/learn/arrays/string-comparison': `字串比較與 strcmp｜${SITE_TITLE}`,
  '/learn/arrays/string-copy': `字串長度與安全複製｜${SITE_TITLE}`,
  '/learn/arrays/bubble-sort': `氣泡排序與提前結束｜${SITE_TITLE}`,
  '/learn/arrays/insertion-sort': `插入排序與右移｜${SITE_TITLE}`,
  '/learn/pointers/basics': `指標、位址與間接存取｜${SITE_TITLE}`,
  '/learn/pointers/swap': `指標參數與交換變數｜${SITE_TITLE}`,
  '/learn/pointers/traversal': `陣列與指標走訪｜${SITE_TITLE}`,
  '/learn/structures/basics': `結構與成員存取｜${SITE_TITLE}`,
  '/learn/structures/arrays': `結構陣列與逐筆統計｜${SITE_TITLE}`,
  '/learn/structures/functions': `結構的函式傳遞與 typedef｜${SITE_TITLE}`,
  '/learn/structures/pointers': `指向結構的指標｜${SITE_TITLE}`,
  '/learn/memory/allocation': `動態記憶體配置與釋放｜${SITE_TITLE}`,
  '/learn/memory/reallocation': `realloc 容量調整與失敗處理｜${SITE_TITLE}`,
  '/learn/memory/ownership': `記憶體所有權、借用與釋放｜${SITE_TITLE}`,
  '/learn/files/reading': `檔案開啟與 fgets 讀取｜${SITE_TITLE}`,
  '/learn/files/score-statistics': `檔案資料驗證與分數統計｜${SITE_TITLE}`,
  '/learn/files/integer-parsing': `strtol 數字解析與輸入驗證｜${SITE_TITLE}`,
  '/learn/files/characters': `fgetc 逐字讀取與 EOF｜${SITE_TITLE}`,
  '/learn/pointers/const': `指標與 const｜${SITE_TITLE}`,
  '/learn/pointers/array-parameters': `陣列作為函式參數｜${SITE_TITLE}`,
  '/learn/pointers/strings': `字串與字元指標｜${SITE_TITLE}`,
}

export function RouteExperience() {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    document.title = routeTitles[pathname] ?? SITE_TITLE
    window.scrollTo({ top: 0, behavior: 'auto' })

    if (firstRender.current) {
      firstRender.current = false
      return
    }

    const main = document.getElementById('main-content')
    if (!main) return
    let focusFrame: number | null = null
    const observer = new MutationObserver(() => scheduleFocus())
    const scheduleFocus = () => {
      if (focusFrame !== null || !main.querySelector('h1')) return
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = null
        const heading = main.querySelector<HTMLElement>('h1')
        if (!heading) return
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
        observer.disconnect()
      })
    }
    observer.observe(main, { childList: true, subtree: true })
    scheduleFocus()

    return () => {
      observer.disconnect()
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame)
    }
  }, [pathname])

  return null
}
