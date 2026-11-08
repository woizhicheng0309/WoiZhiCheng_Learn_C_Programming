import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageBoundary, PageLoading } from './components/PageBoundary'
import { RouteExperience } from './components/RouteExperience'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { HomePage } from './pages/HomePage'

const LearnPage = lazy(() => import('./pages/LearnPage').then(module => ({ default: module.LearnPage })))
const ForLoopLabPage = lazy(() => import('./pages/ForLoopLabPage').then(module => ({ default: module.ForLoopLabPage })))
const WhileLoopLessonPage = lazy(() => import('./pages/WhileLoopLessonPage').then(module => ({ default: module.WhileLoopLessonPage })))
const LoopControlLessonPage = lazy(() => import('./pages/LoopControlLessonPage').then(module => ({ default: module.LoopControlLessonPage })))
const VariablesBasicsPage = lazy(() => import('./pages/VariablesBasicsPage').then(module => ({ default: module.VariablesBasicsPage })))
const ConditionalsLessonPage = lazy(() => import('./pages/ConditionalsLessonPage').then(module => ({ default: module.ConditionalsLessonPage })))
const FunctionLessonPage = lazy(() => import('./pages/FunctionLessonPage').then(module => ({ default: module.FunctionLessonPage })))
const ArrayLessonPage = lazy(() => import('./pages/ArrayLessonPage').then(module => ({ default: module.ArrayLessonPage })))
const PointerLessonPage = lazy(() => import('./pages/PointerLessonPage').then(module => ({ default: module.PointerLessonPage })))
const PointerSwapLessonPage = lazy(() => import('./pages/PointerSwapLessonPage').then(module => ({ default: module.PointerSwapLessonPage })))
const PointerTraversalLessonPage = lazy(() => import('./pages/PointerTraversalLessonPage').then(module => ({ default: module.PointerTraversalLessonPage })))
const StringPointerLessonPage = lazy(() => import('./pages/StringPointerLessonPage').then(module => ({ default: module.StringPointerLessonPage })))
const SwitchLessonPage = lazy(() => import('./pages/SwitchLessonPage').then(module => ({ default: module.SwitchLessonPage })))
const RecursionLessonPage = lazy(() => import('./pages/RecursionLessonPage').then(module => ({ default: module.RecursionLessonPage })))
const MatrixLessonPage = lazy(() => import('./pages/MatrixLessonPage').then(module => ({ default: module.MatrixLessonPage })))
const SearchLessonPage = lazy(() => import('./pages/SearchLessonPage').then(module => ({ default: module.SearchLessonPage })))
const BinarySearchLessonPage = lazy(() => import('./pages/BinarySearchLessonPage').then(module => ({ default: module.BinarySearchLessonPage })))
const SelectionSortLessonPage = lazy(() => import('./pages/SelectionSortLessonPage').then(module => ({ default: module.SelectionSortLessonPage })))
const InsertionSortLessonPage = lazy(() => import('./pages/InsertionSortLessonPage').then(module => ({ default: module.InsertionSortLessonPage })))
const BubbleSortLessonPage = lazy(() => import('./pages/BubbleSortLessonPage').then(module => ({ default: module.BubbleSortLessonPage })))

const StringCopyLessonPage = lazy(() => import('./pages/StringCopyLessonPage').then(module => ({ default: module.StringCopyLessonPage })))

const ArrayParameterLessonPage = lazy(() => import('./pages/ArrayParameterLessonPage').then(module => ({ default: module.ArrayParameterLessonPage })))

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <RouteExperience />
      <SiteHeader />
      <main id="main-content">
        <PageBoundary key={pathname}>
          <Suspense fallback={<PageLoading />}>
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
              <Route path="/learn/arrays/insertion-sort" element={<InsertionSortLessonPage />} />
              <Route path="/learn/arrays/bubble-sort" element={<BubbleSortLessonPage />} />
              <Route path="/learn/arrays/string-copy" element={<StringCopyLessonPage />} />
              <Route path="/learn/pointers/basics" element={<PointerLessonPage />} />
              <Route path="/learn/pointers/swap" element={<PointerSwapLessonPage />} />
              <Route path="/learn/pointers/traversal" element={<PointerTraversalLessonPage />} />
              <Route path="/learn/pointers/strings" element={<StringPointerLessonPage />} />
              <Route path="/learn/pointers/array-parameters" element={<ArrayParameterLessonPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </PageBoundary>
      </main>
      <SiteFooter />
    </div>
  )
}
