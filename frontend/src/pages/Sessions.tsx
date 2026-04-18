import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '../lib/api'
import { Trash2, MessageSquare, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

const PLATFORM_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  telegram: { color: '#05d9e8', bg: 'rgba(5,217,232,0.12)', label: 'Telegram' },
  discord: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Discord' },
  cli: { color: '#00ff41', bg: 'rgba(0,255,65,0.1)', label: 'CLI' },
  web: { color: '#ffb000', bg: 'rgba(255,176,0,0.1)', label: 'Web' },
  whatsapp: { color: '#25D366', bg: 'rgba(37,211,102,0.1)', label: 'WhatsApp' },
  api: { color: '#ff2a6d', bg: 'rgba(255,42,109,0.1)', label: 'API' },
}

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null
  const style = PLATFORM_STYLES[platform.toLowerCase()] || {
    color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: platform.toUpperCase()
  }
  return (
    <span
      className="badge"
      style={{ color: style.color, background: style.bg, border: `1px solid ${style.color}40` }}
    >
      {style.label}
    </span>
  )
}

export default function Sessions() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })


  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setDeleting(null)
    },
  })

  const filtered = sessions.filter(
    (s) => s.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <div className="title-bar" />
          <div>
            <h1>SESSIONS</h1>
            <p>{sessions.length} total session{sessions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative" style={{ marginBottom: '1.5rem' }}>
        <Search size={14} className="absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          className="input-search"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '4rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center" style={{ padding: '2.5rem' }}>
          <MessageSquare size={32} style={{ color: 'var(--border)', margin: '0 auto 0.75rem' }} />
          <p className="text-muted">
            {search ? 'No sessions match your search.' : 'No sessions yet. Create one!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="card flex items-center gap-4 cursor-pointer group"
              style={{ padding: '1rem' }}
            >
              <Link
                to={`/sessions/${s.id}`}
                className="flex-1 min-h-0 flex items-center gap-3 no-underline"
              >
                <div
                  style={{
                    width: '2rem', height: '2rem', borderRadius: '0.25rem',
                    background: 'rgba(0,255,65,0.08)',
                    border: '1px solid rgba(0,255,65,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <MessageSquare size={14} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="min-h-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="fw-medium truncate" style={{ color: 'var(--txt)', margin: 0 }}>
                      {s.title || `Session ${s.id}`}
                    </p>
                    <PlatformBadge platform={s.platform} />
                  </div>
                  <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                    {s.message_count} msg{s.message_count !== 1 ? 's' : ''} — {new Date(s.updated).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-3 shrink-0">
                {s.model && (
                  <span className="badge badge-cyan hidden" style={{ display: 'inline-flex' }}>
                    {s.model}
                  </span>
                )}
                <button
                  className="opacity-0 group-hover:opacity-50 transition-opacity btn-icon"
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleting(s.id)
                  }}
                  style={{ color: 'var(--pink)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="modal-overlay">
          <div className="modal" style={{ borderColor: 'rgba(255,42,109,0.4)' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--pink)' }}>DELETE SESSION</span>
            </div>
            <p className="text-sm text-muted mb-4">
              This action is irreversible. The session "{sessions.find(s => s.id === deleting)?.title}" will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1" onClick={() => setDeleting(null)}>Cancel</button>
              <button
                className="btn flex-1"
                style={{ background: 'var(--pink)', color: '#fff', borderColor: 'var(--pink)' }}
                onClick={() => deleteMutation.mutate(deleting)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
