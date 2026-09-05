import { Navigate, Route, Routes } from 'react-router-dom'
import { RouteExperience } from './components/RouteExperience'
import { SiteFooter, SiteHeader } from './components/SiteChrome'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { ForLoopLabPage } from './pages/ForLoopLabPage'
import { VariablesBasicsPage } from './pages/VariablesBasicsPage'
import { ConditionalsLessonPage } from './pages/ConditionalsLessonPage'
import { FunctionLessonPage } from './pages/FunctionLessonPage'
import { ArrayLessonPage } from './pages/ArrayLessonPage'

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
          <Route path="/learn/loops/for" element={<ForLoopLabPage />} />
          <Route path="/learn/functions/basics" element={<FunctionLessonPage />} />
          <Route path="/learn/arrays/basics" element={<ArrayLessonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}
