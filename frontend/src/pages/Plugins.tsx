import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pluginsApi } from '../lib/api'
import { Puzzle, X } from 'lucide-react'

export default function Plugins() {
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => pluginsApi.list(),
  })

  const { data: pluginDetail } = useQuery({
    queryKey: ['plugin', selected],
    queryFn: () => pluginsApi.get(selected!),
    enabled: !!selected,
  })

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <div className="title-bar" />
          <div>
            <h1>PLUGINS</h1>
            <p>Hermes plugin ecosystem</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted">Loading...</p>
      ) : !data?.plugins?.length ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <Puzzle size={40} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
          <p className="text-muted">No plugins found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {data.plugins.map((p: any) => (
            <div
              key={p.name}
              className="card cursor-pointer"
              onClick={() => setSelected(p.name)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-mono fw-bold" style={{ color: 'var(--primary)', margin: 0 }}>{p.name}</h3>
              </div>
              <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--txt)' }}>{p.description || 'No description'}</p>
              <div className="flex gap-2 text-xs font-mono text-muted">
                {p.version && <span>v{p.version}</span>}
                {p.author && <span>by {p.author}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && pluginDetail && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div
            style={{ background: 'var(--surf)', border: '1px solid var(--primary)', borderRadius: '0.5rem', width: '100%', maxWidth: '48rem', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-mono fw-bold" style={{ color: 'var(--primary)', margin: 0 }}>{pluginDetail.name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-4">
              {pluginDetail.readme ? (
                <pre className="whitespace-pre-wrap text-sm font-mono" style={{ color: 'var(--txt)' }}>{pluginDetail.readme}</pre>
              ) : (
                <p className="text-muted font-mono">No README available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
