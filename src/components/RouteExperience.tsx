import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_TITLE = '魏志成的程式設計基礎學習網站'

const routeTitles: Record<string, string> = {
  '/': SITE_TITLE,
  '/learn': `課程地圖｜${SITE_TITLE}`,
  '/learn/variables/basics': `程式骨架、變數與運算｜${SITE_TITLE}`,
  '/learn/conditionals/if-else': `if 與 else｜${SITE_TITLE}`,
  '/learn/loops/for': `for 迴圈實驗室｜${SITE_TITLE}`,
  '/learn/functions/basics': `函式、參數與回傳值｜${SITE_TITLE}`,
  '/learn/arrays/basics': `陣列、索引與字串｜${SITE_TITLE}`,
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

    const focusHeading = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('#main-content h1')
      if (!heading) return
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(focusHeading)
  }, [pathname])

  return null
}
