import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageLoading() {
  return <section className="page-width page-message" role="status" aria-live="polite">
    <p className="section-kicker">正在載入</p>
    <p>正在準備互動單元，請稍候。</p>
  </section>
}

interface PageBoundaryProps { children: ReactNode; onReload?: () => void }

export class PageBoundary extends Component<PageBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="page-width page-message" role="alert">
      <h1>頁面暫時無法開啟</h1>
      <p>請確認網路連線後重新載入。已儲存的學習進度會保留在這台裝置。</p>
      <div className="page-message__actions">
        <button className="button button-primary" onClick={this.props.onReload ?? (() => window.location.reload())}>重新載入此頁</button>
        <Link className="button button-secondary" to="/">回到首頁</Link>
      </div>
    </section>
  }
}
