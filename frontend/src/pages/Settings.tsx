import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../stores/appStore'
import { systemApi } from '../lib/api'
import { Eye, Monitor, Info, Cpu, RefreshCw, Zap, AlertTriangle } from 'lucide-react'

const THEMES = [
  { id: 'dark',   label: 'Dark',   bg: '#0a0a0f', colors: ['#00ff41','#05d9e8','#ff2a6d','#d400ff'], labelActive: '#00ff41', labelInactive: '#e0e0e0' },
  { id: 'light',  label: 'Light',  bg: '#f0f0f0', colors: ['#00aa2a','#0088cc','#cc1a5e','#8800cc'], labelActive: '#004400', labelInactive: '#555555' },
  { id: 'amber',  label: 'Amber',  bg: '#0d0a00', colors: ['#ffb000','#ff6600','#ff2a6d','#ffaa00'], labelActive: '#ffb000', labelInactive: '#e0d0c0' },
  { id: 'blood',  label: 'Blood',  bg: '#0f0a0a', colors: ['#ff2a6d','#ff6b35','#ff2a6d','#ff4444'], labelActive: '#ff2a6d', labelInactive: '#e0d0d0' },
  { id: 'blue',   label: 'Blue',   bg: '#050510', colors: ['#00d4ff','#0066ff','#d400ff','#00aaff'], labelActive: '#00d4ff', labelInactive: '#d0e0ff' },
  { id: 'green',  label: 'Green',  bg: '#001a00', colors: ['#00ff41','#00cc33','#05d9e8','#00ff41'], labelActive: '#00ff41', labelInactive: '#e0ffe0' },
  { id: 'sunset', label: 'Sunset', bg: '#1a0808', colors: ['#ff6b35','#ff2a6d','#ffb000','#ff6b35'], labelActive: '#ff6b35', labelInactive: '#ffe0d0' },
  { id: 'matrix', label: 'Matrix', bg: '#000800', colors: ['#00ff41','#00cc33','#00aa28','#00ff41'], labelActive: '#00ff41', labelInactive: '#e0ffe0' },
]

export default function Settings() {
  const qc = useQueryClient()
  const { theme, setTheme, scanlines, toggleScanlines } = useAppStore()
  const [restarting, setRestarting] = useState(false)
  const [restartResult, setRestartResult] = useState<string | null>(null)

  const { data: sysConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => systemApi.config(),
  }) as any

  const { data: gateway } = useQuery({
    queryKey: ['gateway'],
    queryFn: () => systemApi.gatewayStatus(),
    refetchInterval: 30000,
  }) as any

  const restartMutation = useMutation({
    mutationFn: () => systemApi.gatewayRestart(),
    onSuccess: (res: any) => {
      setRestartResult(res.message)
      setRestarting(false)
      qc.invalidateQueries({ queryKey: ['gateway'] })
      setTimeout(() => setRestartResult(null), 8000)
    },
    onError: () => {
      setRestartResult("Restart failed — check logs")
      setRestarting(false)
      setTimeout(() => setRestartResult(null), 8000)
    },
  })

  const cfg = sysConfig || {}
  const currentModel = (cfg.model as any) || {}

  // Filter exit_reason that mentions telegram
  const exitReason = gateway?.state?.exit_reason
  const filteredExitReason = exitReason && !String(exitReason).toLowerCase().includes('telegram')
    ? exitReason : null

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 4, height: '2rem', background: '#05d9e8', borderRadius: 2, boxShadow: '0 0 12px rgba(5,217,232,0.6)' }} />
        <div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#05d9e8', textShadow: '0 0 8px rgba(5,217,232,0.4)', margin: 0 }}>SETTINGS</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '2px 0 0' }}>Customize CyberUI</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>

        {/* Gateway Status */}
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Zap size={16} style={{ color: '#05d9e8' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#05d9e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gateway Status</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '0.75rem', height: '0.75rem', borderRadius: '50%',
                background: gateway?.running ? '#00ff41' : '#ff4444',
                boxShadow: gateway?.running ? '0 0 8px rgba(0,255,65,0.6)' : '0 0 8px rgba(255,68,68,0.6)'
              }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--txt)' }}>
                {gateway?.running ? `Running (PID ${gateway?.pid})` : 'Stopped'}
              </span>
            </div>
            {gateway?.state?.platforms && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(gateway.state.platforms as Record<string, any>)
                  .filter(([platform]) => platform !== 'telegram' && platform !== 'api_server')
                  .map(([platform, info]: [string, any]) => {
                    const hasError = !!(info.error_code || info.error_message)
                    const isConnected = info.state === 'connected' && !hasError
                    return (
                      <div key={platform} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '9999px', fontSize: '0.7rem',
                        background: isConnected ? 'rgba(0,255,65,0.1)' : 'rgba(255,68,68,0.1)',
                        border: `1px solid ${isConnected ? '#00ff4140' : '#ff444440'}`,
                        color: isConnected ? '#00ff41' : '#ff4444',
                      }}>
                        <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                        <span style={{ color: 'var(--muted)' }}>{isConnected ? 'OK' : (info.error_code?.replace(/_/g, ' ') || 'ERR')}</span>
                      </div>
                    )
                  })}
              </div>
            )}
            {filteredExitReason && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#ff4444' }}>
                <AlertTriangle size={12} />
                <span>{String(filteredExitReason).slice(0, 80)}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                className="btn btn-sm"
                onClick={() => { setRestarting(true); setRestartResult(null); restartMutation.mutate() }}
                disabled={restarting || restartMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={restarting || restartMutation.isPending ? 'spinning' : ''} />
                {restarting || restartMutation.isPending ? 'Restarting...' : 'Restart Gateway'}
              </button>
              {restartResult && (
                <span style={{ fontSize: '0.75rem', color: restartResult.includes('success') ? '#00ff41' : '#ff4444' }}>
                  {restartResult}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Model Selector */}
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Cpu size={16} style={{ color: '#05d9e8' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#05d9e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Model</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Model:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#00ff41' }}>{currentModel.default || '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Provider:</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#05d9e8' }}>{currentModel.provider || '—'}</span>
            </div>
            {currentModel.base_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Endpoint:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--muted)' }}>{currentModel.base_url}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scanlines */}
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Eye size={16} style={{ color: '#05d9e8' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#05d9e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Visual Effects</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <div
              onClick={toggleScanlines}
              style={{
                width: '3rem', height: '1.5rem', borderRadius: '9999px',
                background: scanlines ? '#00ff41' : 'var(--border)',
                position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0
              }}
            >
              <div style={{
                width: '1.125rem', height: '1.125rem', borderRadius: '50%',
                background: scanlines ? '#000' : 'var(--muted)',
                position: 'absolute', top: '3px',
                left: scanlines ? '1.5rem' : '3px',
                transition: 'left 0.2s, background 0.2s', cursor: 'pointer'
              }} />
            </div>
            <span style={{ fontSize: '0.875rem', color: 'var(--txt)' }}>Scanlines overlay</span>
          </label>
        </div>

        {/* Theme selector */}
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Monitor size={16} style={{ color: '#05d9e8' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#05d9e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Color Theme</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))', gap: '0.75rem' }}>
            {THEMES.map(t => {
              const isActive = theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  style={{
                    padding: '0.75rem', borderRadius: '0.5rem',
                    border: `2px solid ${isActive ? t.labelActive : 'var(--border)'}`,
                    background: t.bg, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 12px ${t.labelActive}40` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                    {t.colors.map((c, i) => (
                      <div key={i} style={{ width: '1rem', height: '1rem', borderRadius: '2px', background: c }} />
                    ))}
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    color: isActive ? t.labelActive : t.labelInactive,
                    fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em'
                  }}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* About */}
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Info size={16} style={{ color: '#05d9e8' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#05d9e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>About</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--muted)' }}>Application</span>
              <span style={{ color: '#00ff41', fontFamily: 'Orbitron, sans-serif' }}>Hermes CyberUI</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--muted)' }}>About</span>
              <span style={{ color: 'var(--txt)', fontFamily: 'JetBrains Mono, monospace' }}>1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--muted)' }}>Framework</span>
              <span style={{ color: 'var(--txt)', fontFamily: 'JetBrains Mono, monospace' }}>React + FastAPI</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--muted)' }}>Port</span>
              <span style={{ color: '#05d9e8', fontFamily: 'JetBrains Mono, monospace' }}>23689</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`.spinning { animation: spin 1s linear infinite } @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
