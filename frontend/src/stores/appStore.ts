import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'amber' | 'blood' | 'blue' | 'green' | 'sunset' | 'matrix'

interface AppState {
  sidebarOpen: boolean
  scanlines: boolean
  theme: Theme
  toggleSidebar: () => void
  toggleScanlines: () => void
  setTheme: (theme: Theme) => void
}

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg': '#0a0a0f', '--bg2': '#12121f', '--surf': '#12121f', '--border': '#1a1a2e',
    '--txt': '#e0e0e0', '--muted': '#6b6b8a', '--primary': '#00ff41',
    '--accent': '#05d9e8', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ffb000',
  },
  light: {
    '--bg': '#f0f0f0', '--bg2': '#e0e0e0', '--surf': '#ffffff', '--border': '#cccccc',
    '--txt': '#111111', '--muted': '#888888', '--primary': '#00aa2a',
    '--accent': '#0088cc', '--pink': '#cc1a5e', '--danger': '#cc0000', '--warning': '#cc8800',
  },
  amber: {
    '--bg': '#0d0a00', '--bg2': '#1a1400', '--surf': '#1a1400', '--border': '#3d2f00',
    '--txt': '#ffd700', '--muted': '#8a7a40', '--primary': '#ffb000',
    '--accent': '#ff6600', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ff6600',
  },
  blood: {
    '--bg': '#0f0a0a', '--bg2': '#1a0f0f', '--surf': '#1a0f0f', '--border': '#3d1515',
    '--txt': '#e0d0d0', '--muted': '#8a4a4a', '--primary': '#ff2a6d',
    '--accent': '#ff6b35', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ff6b35',
  },
  blue: {
    '--bg': '#050510', '--bg2': '#0a0a1e', '--surf': '#0a0a1e', '--border': '#0d1440',
    '--txt': '#d0e0ff', '--muted': '#4a5a8a', '--primary': '#00d4ff',
    '--accent': '#0066ff', '--pink': '#d400ff', '--danger': '#ff4444', '--warning': '#ffaa00',
  },
  green: {
    '--bg': '#001a00', '--bg2': '#002200', '--surf': '#001a00', '--border': '#004400',
    '--txt': '#00ff41', '--muted': '#00aa28', '--primary': '#00ff41',
    '--accent': '#05d9e8', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ffb000',
  },
  sunset: {
    '--bg': '#1a0808', '--bg2': '#2a1010', '--surf': '#1a0808', '--border': '#4a1818',
    '--txt': '#ffe0d0', '--muted': '#8a4a3a', '--primary': '#ff6b35',
    '--accent': '#ffb000', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ffb000',
  },
  matrix: {
    '--bg': '#000800', '--bg2': '#001000', '--surf': '#000800', '--border': '#003300',
    '--txt': '#00ff41', '--muted': '#005500', '--primary': '#00ff41',
    '--accent': '#00cc33', '--pink': '#ff2a6d', '--danger': '#ff4444', '--warning': '#ffb000',
  },
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const vars = THEMES[theme]
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  // Also apply --green, --cyan, --amber, --purple aliases for compatibility
  root.style.setProperty('--green', vars['--primary'])
  root.style.setProperty('--cyan', vars['--accent'])
  root.style.setProperty('--amber', vars['--warning'])
  root.style.setProperty('--purple', vars['--pink'])
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      scanlines: false,
      theme: 'dark',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleScanlines: () => set((s) => {
        const next = !s.scanlines
        document.body.classList.toggle('scanlines-active', next)
        return { scanlines: next }
      }),
      setTheme: (_theme: Theme) => {
        applyTheme(_theme)
        set({ theme: _theme })
      },
    }),
    {
      name: 'hermes-cyber-store',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyTheme(state.theme)
          if (state.scanlines) document.body.classList.add('scanlines-active')
        }
      },
    }
  )
)
