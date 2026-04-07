import { useQuery } from '@tanstack/react-query'
import { systemApi, sessionsApi, skillsApi } from '../lib/api'
import { Cpu, HardDrive, MemoryStick, MessageSquare, Brain, Zap, Globe, Link2 } from 'lucide-react'

function StatCard({ icon, label, value, sub, valueColor }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  valueColor: string
}) {
  return (
    <div className="stat-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div style={{
        fontSize: '1.5rem', fontWeight: 700, color: valueColor,
        fontFamily: 'Orbitron, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {value}
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '0.25rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub}
      </p>
    </div>
  )
}

const PLATFORM_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  telegram: { color: '#05d9e8', bg: 'rgba(5,217,232,0.12)', label: 'Telegram' },
  discord: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Discord' },
  cli:      { color: '#00ff41', bg: 'rgba(0,255,65,0.10)',  label: 'CLI' },
  web:      { color: '#ffb000', bg: 'rgba(255,176,0,0.10)',  label: 'Web' },
}

function PlatformBadge({ platform }: { platform: string | null | undefined }) {
  const style = platform
    ? (PLATFORM_STYLES[platform.toLowerCase()] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: platform.toUpperCase() })
    : { color: '#00ff41', bg: 'rgba(0,255,65,0.10)', label: 'CLI' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600,
      background: style.bg, color: style.color,
      border: `1px solid ${style.color}40`
    }}>
      {style.label}
    </span>
  )
}

export default function Dashboard() {
  const { data: sys } = useQuery({ queryKey: ['system'], queryFn: systemApi.info })
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list })
  const { data: skills } = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list })
  const { data: network } = useQuery({ queryKey: ['network'], queryFn: systemApi.networkInfo })

  // Parse hostname cleanly (drop domain part)
  const hostname = sys?.hostname?.split('.')[0] ?? '—'
  // Parse macOS version from Darwin Kernel Version string
  const darwinMatch = sys?.platform_version?.match(/Darwin Kernel Version (\d+[\d.]+)/)
  const osVersion = darwinMatch ? `macOS ${darwinMatch[1]}` : (sys?.platform_version?.split(':')[0] ?? '—')
  const uptime = sys?.uptime ? new Date(sys.uptime).toLocaleString() : '—'

  // Sort sessions by most recent first
  const recentSessions = [...(sessions ?? [])]
    .sort((a, b) => (b.updated > a.updated ? 1 : -1))
    .slice(0, 8)

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 4, height: '2rem', background: '#00ff41', borderRadius: 2, boxShadow: '0 0 12px rgba(0,255,65,0.6)' }} />
        <div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#00ff41', textShadow: '0 0 8px rgba(0,255,65,0.6)', margin: 0 }}>SYSTEM STATUS</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '2px 0 0' }}>Hermes CyberUI — {uptime}</p>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={<MessageSquare size={14} style={{ color: '#00ff41' }} />} label="Sessions" value={sys?.session_count ?? '—'} sub={`${sessions?.length ?? 0} total`} valueColor="#00ff41" />
        <StatCard icon={<Brain size={14} style={{ color: '#05d9e8' }} />} label="Skills" value={sys?.skill_count ?? '—'} sub={`${skills?.skills?.length ?? 0} available`} valueColor="#05d9e8" />
        <StatCard icon={<Cpu size={14} style={{ color: '#f5d400' }} />} label="CPU Cores" value={sys?.cpu_count ?? '—'} sub={sys?.platform ?? 'Unknown OS'} valueColor="#f5d400" />
        <StatCard icon={<Zap size={14} style={{ color: '#ff2a6d' }} />} label="Hostname" value={hostname} sub={osVersion} valueColor="#ff2a6d" />
      </div>

      {/* Memory & Disk */}
      {(sys?.memory_percent != null || sys?.disk_percent != null) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}><span>//</span> RESOURCE USAGE</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sys?.memory_percent != null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#9ca3af' }}><MemoryStick size={12} style={{ display: 'inline', marginRight: '4px' }} />RAM</span>
                  <span style={{ color: '#00ff41' }}>{sys.memory_used_gb}GB / {sys.memory_total_gb}GB ({sys.memory_percent}%)</span>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${sys.memory_percent}%` }} /></div>
              </div>
            )}
            {sys?.disk_percent != null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#9ca3af' }}><HardDrive size={12} style={{ display: 'inline', marginRight: '4px' }} />Disk</span>
                  <span style={{ color: '#05d9e8' }}>{sys.disk_used_gb}GB / {sys.disk_total_gb}GB ({sys.disk_percent}%)</span>
                </div>
                <div className="progress" style={{ background: '#1c2333' }}>
                  <div className="progress-bar" style={{ width: `${sys.disk_percent}%`, background: 'linear-gradient(90deg, #05d9e8, #d400ff)' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Network access card */}
      {network?.addresses && network.addresses.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            <Globe size={12} style={{ display: 'inline', marginRight: '6px', color: '#05d9e8' }} />
            NETWORK ACCESS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {network.addresses.map((addr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link2 size={14} style={{ color: '#05d9e8', flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', minWidth: '70px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{addr.type}</span>
                <a
                  href={`http://${addr.address}:${addr.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.875rem', color: '#05d9e8', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  http://{addr.address}:{addr.port}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions — sorted by most recent, all platforms */}
      {recentSessions.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}><span>//</span> RECENT SESSIONS</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Platform</th>
                <th>Messages</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/sessions/${s.id}`}>
                  <td style={{ color: '#00ff41', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || `Session ${s.id}`}</td>
                  <td><PlatformBadge platform={s.platform} /></td>
                  <td style={{ color: 'var(--muted)' }}>{s.message_count}</td>
                  <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(s.updated).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Installed skills */}
      {skills?.skills && skills.skills.length > 0 && (
        <div className="card">
          <h2 className="section-title" style={{ marginBottom: '1rem' }}><span>//</span> INSTALLED SKILLS</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {skills.skills.slice(0, 20).map((s) => (
              <a key={s.name} href="/skills" className="badge badge-green" style={{ textDecoration: 'none' }}>{s.name}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
