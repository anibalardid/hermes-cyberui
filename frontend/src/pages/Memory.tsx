import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { memoryApi } from '../lib/api'
import { Save, RotateCcw } from 'lucide-react'

export default function Memory() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [memory, setMemory] = useState('')
  const [user, setUser] = useState('')
  const [tab, setTab] = useState<'memory' | 'user'>('memory')
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['memory'],
    queryFn: memoryApi.get,
  })

  useEffect(() => {
    if (data) { setMemory(data.memory); setUser(data.user) }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => memoryApi.save({ memory, user }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory'] })
      setSaved(true); setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const discardChanges = () => {
    setMemory(data?.memory || '')
    setUser(data?.user || '')
    setEditing(false)
  }

  const currentContent = tab === 'memory' ? memory : user
  const setCurrentContent = tab === 'memory' ? setMemory : setUser

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 4, height: '2rem', background: '#d400ff', borderRadius: 2, boxShadow: '0 0 12px rgba(212,0,255,0.6)' }} />
          <div>
            <h1 className="font-display" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#d400ff', textShadow: '0 0 8px rgba(212,0,255,0.5)', margin: 0 }}>MEMORY</h1>
            <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>Persistent context across sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs glow-green" style={{ color: '#00ff41' }}>✓ Saved</span>}
          {editing && (
            <button className="btn btn-sm btn-ghost" onClick={discardChanges}>
              <RotateCcw size={12} />Discard
            </button>
          )}
          <button className="btn btn-sm" style={{ borderColor: 'rgba(212,0,255,0.3)', color: '#d400ff', background: 'rgba(212,0,255,0.05)' }} onClick={() => saveMutation.mutate()} disabled={!editing || saveMutation.isPending}>
            <Save size={12} />Save
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs px-6">
        {(['memory', 'user'] as const).map((t) => (
          <button
            key={t}
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'memory' ? 'MEMORY.md' : 'USER.md'}
          </button>
        ))}
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex flex-col" style={{ height: '100%' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="section-title">{tab === 'memory' ? 'MEMORY.md' : 'USER.md'} — {editing ? 'EDITING' : 'PREVIEW'}</span>
            <button className="text-xs" style={{ color: editing ? '#00ff41' : 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setEditing(!editing)}>
              {editing ? '[ Preview ]' : '[ Edit ]'}
            </button>
          </div>
          {isLoading ? (
            <div className="skeleton" style={{ height: '100%', borderRadius: '0.5rem' }} />
          ) : editing ? (
            <textarea
              className="flex-1 w-full font-mono text-sm p-4 rounded border resize-none"
              style={{ minHeight: '400px', color: 'var(--txt)', outline: 'none', background: 'var(--bg)', borderColor: editing ? 'rgba(212,0,255,0.3)' : 'var(--border)' }}
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
            />
          ) : (
            <pre
              className="flex-1 overflow-y-auto p-4 rounded border"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--txt)', fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {currentContent || '_Empty file_'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
