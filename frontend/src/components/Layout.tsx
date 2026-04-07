import { useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import {
  LayoutDashboard, MessageSquare, Brain, Database,
  Settings, ChevronLeft, ChevronRight, Terminal,
  Clock, Puzzle, FileText, UserCircle, Bot, Eye
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/skills', icon: Brain, label: 'Skills' },
  { to: '/memory', icon: Database, label: 'Memory' },
  { to: '/crons', icon: Clock, label: 'Crons' },
  { to: '/plugins', icon: Puzzle, label: 'Plugins' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/profiles', icon: UserCircle, label: 'Profiles' },
  { to: '/multiagent', icon: Bot, label: 'Multi-Agent' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { sidebarOpen, toggleSidebar, scanlines, toggleScanlines, theme } = useAppStore()

  useEffect(() => {
    const root = document.documentElement
    root.className = ''
    root.classList.add(`theme-${theme}`)
  }, [theme])

  const sidebarWidth = sidebarOpen ? '14rem' : '3.5rem'

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--cyber-bg)',
    }}>
      {/* Sidebar */}
      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: sidebarWidth,
        background: 'var(--cyber-bg)',
        borderRight: '1px solid var(--cyber-border)',
        transition: 'width 0.2s',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '1rem 0.75rem',
          borderBottom: '1px solid var(--cyber-border)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '0.25rem',
            background: 'var(--cyber-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Terminal size={14} style={{ color: 'var(--cyber-bg)' }} />
          </div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.875rem',
                lineHeight: 1.2,
                color: 'var(--cyber-primary)',
              }}>HERMES</div>
              <div style={{
                fontSize: '0.45rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--cyber-pink)',
              }}>CyberUI</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1,
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflow: 'hidden',
        }}>
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                color: isActive ? 'var(--cyber-primary)' : 'var(--cyber-text)',
                background: isActive ? 'rgba(0,255,65,0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                border: isActive ? '1px solid rgba(0,255,65,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && (
                <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{
          padding: '0.5rem',
          borderTop: '1px solid var(--cyber-border)',
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
              color: 'var(--cyber-muted)',
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
              color: 'var(--cyber-muted)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cyber-bg)',
        minWidth: 0,
      }}>
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
