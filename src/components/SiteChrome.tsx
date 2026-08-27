import { ArrowUpRight, Braces, GitFork, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '首頁', end: true },
  { to: '/learn', label: '課程地圖', end: false },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="回到首頁" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <Braces size={19} strokeWidth={2.2} />
          </span>
          <span>
            <strong>魏志成</strong>
            <small>程式設計基礎</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="主要導覽">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <a
          className="header-github desktop-only"
          href="https://github.com/woizhicheng0309/WoiZhiCheng_Learn_C_Programming"
          target="_blank"
          rel="noreferrer"
        >
          <GitFork size={17} aria-hidden="true" />
          <span>原始碼</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>

        <button
          className="menu-button"
          type="button"
          aria-label={open ? '關閉導覽選單' : '開啟導覽選單'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="mobile-nav"
            aria-label="行動版導覽"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'mobile-nav-link active' : 'mobile-nav-link')}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <p className="footer-title">把抽象的程式邏輯，變成看得見的過程。</p>
          <p>為 C 語言初學者設計的互動學習空間。</p>
        </div>
        <div className="footer-meta">
          <a
            href="https://github.com/woizhicheng0309/WoiZhiCheng_Learn_C_Programming"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={17} aria-hidden="true" /> GitHub
          </a>
          <span>© {new Date().getFullYear()} 魏志成</span>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  )
}
