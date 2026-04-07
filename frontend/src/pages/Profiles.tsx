import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '../lib/api'
import { UserCircle, Plus, Eye, Check } from 'lucide-react'

export default function Profiles() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => profilesApi.list(),
  })

  const [viewProfile, setViewProfile] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const createMutation = useMutation({
    mutationFn: (name: string) => profilesApi.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); setCreating(false); setNewName('') },
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: any }) => profilesApi.update(name, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); setEditData(null) },
  })

  // Fetch full profile config when viewing
  const { data: viewData } = useQuery({
    queryKey: ['profile', viewProfile],
    queryFn: () => profilesApi.get(viewProfile!),
    enabled: !!viewProfile,
  })

  const profiles = data?.profiles || []
  const activeProfile = data?.active

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <div className="title-bar" />
          <div>
            <h1>PROFILES</h1>
            <p>LLM configuration profiles</p>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New Profile
        </button>
      </div>

      {/* Create dialog */}
      {creating && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <p style={{ color: 'var(--txt)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Create new profile</p>
          <input
            className="input"
            placeholder="profile-name"
            value={newName}
            onChange={e => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            style={{ marginBottom: '0.75rem', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-sm" disabled={!newName} onClick={() => createMutation.mutate(newName)}>
              Create
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setCreating(false); setNewName('') }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Profile detail view */}
      {viewProfile && viewData && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={16} style={{ color: 'var(--cyan)' }} />
              <span className="font-mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>{viewProfile}</span>
              {activeProfile === viewProfile && <span className="badge badge-green">active</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {editData === null ? (
                <button className="btn btn-sm" onClick={() => setEditData(viewData.config || {})}>Edit</button>
              ) : (
                <>
                  <button className="btn btn-sm" onClick={() => updateMutation.mutate({ name: viewProfile, data: editData })}>Save</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditData(null)}>Cancel</button>
                </>
              )}
            </div>
          </div>

          {editData !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {['model', 'provider', 'description'].map(field => (
                <div key={field}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>{field.toUpperCase()}</label>
                  <input
                    className="input"
                    value={editData[field] || ''}
                    onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <pre style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '1rem', fontSize: '0.75rem',
              color: 'var(--txt)', overflowX: 'auto', maxHeight: '400px'
            }}>
              {JSON.stringify(viewData.config || viewData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Profile list */}
      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : profiles.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <UserCircle size={40} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>No profiles found</p>
          <button className="btn" onClick={() => setCreating(true)}>
            <Plus size={14} /> Create First Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {profiles.map(p => (
            <div
              key={p.name}
              className="card"
              style={{ cursor: viewProfile === p.name ? 'default' : 'pointer' }}
              onClick={() => setViewProfile(viewProfile === p.name ? null : p.name)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="font-mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>{p.name}</span>
                {activeProfile === p.name && (
                  <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={10} /> active
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{p.description || 'No description'}</p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                {p.model && <span>Model: <span style={{ color: 'var(--primary)' }}>{p.model}</span></span>}
                {p.provider && <span>Provider: <span style={{ color: 'var(--accent)' }}>{p.provider}</span></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
