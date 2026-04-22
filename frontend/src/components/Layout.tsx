import { useEffect, useState, useCallback } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import {
  LayoutDashboard, MessageSquare, Brain, Database,
  Settings, ChevronLeft, ChevronRight, Terminal,
  Clock, Puzzle, FileText, UserCircle, Bot, Eye, FolderOpen, Menu, X, Activity, UserCheck, Kanban, MessagesSquare
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/conversations', icon: MessagesSquare, label: 'Conversations' },
  { to: '/skills', icon: Brain, label: 'Skills' },
  { to: '/memory', icon: Database, label: 'Memory' },
  { to: '/crons', icon: Clock, label: 'Crons' },
  { to: '/jobs', icon: Activity, label: 'Jobs' },
  { to: '/kanban', icon: Kanban, label: 'Tasks' },
  { to: '/plugins', icon: Puzzle, label: 'Plugins' },
  { to: '/files', icon: FolderOpen, label: 'Files' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/profiles', icon: UserCircle, label: 'Profiles' },
  { to: '/multiagent', icon: Bot, label: 'Multi-Agent' },
  { to: '/config', icon: UserCheck, label: 'Config' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export default function Layout() {
  const { sidebarOpen, toggleSidebar, scanlines, toggleScanlines, theme } = useAppStore()
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.className = ''
    root.classList.add(`theme-${theme}`)
  }, [theme])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const sidebarWidth = sidebarOpen ? '14rem' : '3.5rem'

  const navItem = useCallback(({ to, icon: Icon, label, end }: typeof NAV[0]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => isMobile && setMobileOpen(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        color: isActive ? 'var(--primary)' : 'var(--txt)',
        background: isActive ? 'rgba(0,255,65,0.08)' : 'transparent',
        fontWeight: isActive ? 600 : 400,
        fontSize: '0.875rem',
        border: isActive ? '1px solid rgba(0,255,65,0.2)' : '1px solid transparent',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      })}
      title={!sidebarOpen && !isMobile ? label : undefined}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {(sidebarOpen || isMobile) && (
        <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      )}
    </NavLink>
  ), [sidebarOpen, isMobile])

  // Desktop sidebar
  const desktopSidebar = (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: sidebarWidth,
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      transition: 'width 0.2s',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem 0.75rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '0.25rem',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Terminal size={14} style={{ color: 'var(--bg)' }} />
          </div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.875rem',
                lineHeight: 1.2,
                color: 'var(--primary)',
              }}>HERMES</div>
              <div style={{
                fontSize: '0.45rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--pink)',
              }}>CyberUI</div>
            </div>
          )}
        </Link>

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflow: 'auto',
      }}>
        {NAV.map(navItem)}
      </nav>

      {/* Bottom controls */}
      <div style={{
        padding: '0.5rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flexShrink: 0,
      }}>
        <button
          onClick={toggleScanlines}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.5rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            fontSize: '0.75rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          title="Toggle scanlines"
        >
          <Eye size={14} />
          {sidebarOpen && <span>Scanlines</span>}
        </button>

        <button
          onClick={toggleSidebar}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.375rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </aside>
  )

  // Mobile sidebar (overlay)
  const mobileSidebar = mobileOpen ? (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 40,
        }}
      />
      {/* Sidebar panel */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '14rem',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
      }}>
        {/* Logo + close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '1rem 0.75rem',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <div style={{
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.25rem',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Terminal size={14} style={{ color: 'var(--bg)' }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.875rem',
                lineHeight: 1.2,
                color: 'var(--primary)',
              }}>HERMES</div>
              <div style={{
                fontSize: '0.45rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--pink)',
              }}>CyberUI</div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1,
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflowY: 'auto',
        }}>
          {NAV.map(navItem)}
        </nav>

        {/* Bottom controls */}
        <div style={{
          padding: '0.5rem',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => { toggleScanlines(); setMobileOpen(false) }}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Eye size={14} />
            <span>Scanlines</span>
          </button>
        </div>
      </aside>
    </>
  ) : null

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Desktop sidebar — always visible */}
      {!isMobile && desktopSidebar}

      {/* Mobile sidebar */}
      {isMobile && mobileSidebar}

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        minWidth: 0,
        position: 'relative',
      }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            flexShrink: 0,
            zIndex: 30,
          }}>
            <button
              onClick={() => setMobileOpen(v => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Menu size={20} />
            </button>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: 'var(--primary)',
              }}>HERMES</div>
              <div style={{
                fontSize: '0.45rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--pink)',
              }}>CyberUI</div>
            </Link>
          </div>
        )}

        {scanlines && (
          <div style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          }} />
        )}
        <Outlet />
      </main>
    </div>
  )
}
