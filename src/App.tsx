import { Navigate, Route, Routes } from 'react-router-dom'
import { RouteExperience } from './components/RouteExperience'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { ForLoopLabPage } from './pages/ForLoopLabPage'
import { WhileLoopLessonPage } from './pages/WhileLoopLessonPage'
import { LoopControlLessonPage } from './pages/LoopControlLessonPage'
import { VariablesBasicsPage } from './pages/VariablesBasicsPage'
import { ConditionalsLessonPage } from './pages/ConditionalsLessonPage'
import { FunctionLessonPage } from './pages/FunctionLessonPage'
import { ArrayLessonPage } from './pages/ArrayLessonPage'
import { PointerLessonPage } from './pages/PointerLessonPage'
import { PointerSwapLessonPage } from './pages/PointerSwapLessonPage'
import { PointerTraversalLessonPage } from './pages/PointerTraversalLessonPage'
import { StringPointerLessonPage } from './pages/StringPointerLessonPage'

import { SwitchLessonPage } from './pages/SwitchLessonPage'

import { RecursionLessonPage } from './pages/RecursionLessonPage'

import { MatrixLessonPage } from './pages/MatrixLessonPage'

import { SearchLessonPage } from './pages/SearchLessonPage'

import { BinarySearchLessonPage } from './pages/BinarySearchLessonPage'

import { SelectionSortLessonPage } from './pages/SelectionSortLessonPage'

export default function App() {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <RouteExperience />
      <SiteHeader />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/variables/basics" element={<VariablesBasicsPage />} />
          <Route path="/learn/conditionals/if-else" element={<ConditionalsLessonPage />} />
          <Route path="/learn/conditionals/switch" element={<SwitchLessonPage />} />
          <Route path="/learn/loops/for" element={<ForLoopLabPage />} />
          <Route path="/learn/loops/while-do-while" element={<WhileLoopLessonPage />} />
          <Route path="/learn/loops/break-continue" element={<LoopControlLessonPage />} />
          <Route path="/learn/functions/basics" element={<FunctionLessonPage />} />
          <Route path="/learn/functions/recursion" element={<RecursionLessonPage />} />
          <Route path="/learn/arrays/basics" element={<ArrayLessonPage />} />
          <Route path="/learn/arrays/matrices" element={<MatrixLessonPage />} />
          <Route path="/learn/arrays/search" element={<SearchLessonPage />} />
          <Route path="/learn/arrays/binary-search" element={<BinarySearchLessonPage />} />
          <Route path="/learn/arrays/selection-sort" element={<SelectionSortLessonPage />} />
          <Route path="/learn/pointers/basics" element={<PointerLessonPage />} />
          <Route path="/learn/pointers/swap" element={<PointerSwapLessonPage />} />
          <Route path="/learn/pointers/traversal" element={<PointerTraversalLessonPage />} />
          <Route path="/learn/pointers/strings" element={<StringPointerLessonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}
