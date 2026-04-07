import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { skillsApi } from '../lib/api'
import { Brain, Plus, Trash2, Edit2, Search, BookOpen } from 'lucide-react'

export default function Skills() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
  })

  const { data: detail } = useQuery({
    queryKey: ['skill', selected],
    queryFn: () => skillsApi.get(selected!),
    enabled: !!selected,
  })

  const createMutation = useMutation({
    mutationFn: () => skillsApi.create({ name: newName, description: newDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      setCreating(false)
      setNewName('')
      setNewDesc('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (content: string) => skillsApi.update(selected!, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skill', selected] })
      qc.invalidateQueries({ queryKey: ['skills'] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => skillsApi.delete(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      setSelected(null)
    },
  })

  const skills = data?.skills ?? []
  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  )

  const openEditor = () => {
    setEditContent(detail?.skill_md || '')
    setEditing(true)
  }

  return (
    <div className="split">
      {/* Skills list */}
      <div className="split-sidebar" style={{ background: 'var(--bg)' }}>
        <div className="split-search">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm fw-bold tracking-wider glow-cyan" style={{ color: 'var(--cyan)', margin: 0, fontFamily: 'Orbitron, sans-serif' }}>
              SKILLS
            </h2>
            <button className="btn btn-sm" style={{ padding: '4px 8px' }} onClick={() => setCreating(true)}>
              <Plus size={12} />
            </button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute" style={{ left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '1.75rem', fontSize: '0.8rem', padding: '6px 8px 6px 1.75rem' }}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ height: '3rem', borderRadius: '0.25rem' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-muted">No skills found.</p>
          ) : (
            filtered.map((s) => (
              <div
                key={s.name}
                className="px-4 py-3 cursor-pointer border-b transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: selected === s.name ? 'rgba(5,217,232,0.06)' : 'transparent',
                  borderBottom: '1px solid var(--border)'
                }}
                onClick={() => { setSelected(s.name); setEditing(false) }}
              >
                <p className="text-sm fw-medium" style={{ color: selected === s.name ? 'var(--cyan)' : 'var(--txt)', margin: 0 }}>
                  {s.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--muted)', margin: '2px 0 0' }}>
                  {s.description || 'No description'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Skill detail / editor */}
      <div className="split-main">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Brain size={40} style={{ color: 'var(--border)', margin: '0 auto 0.75rem' }} />
              <p className="text-sm text-muted">Select a skill to view its contents.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Brain size={14} style={{ color: 'var(--cyan)' }} />
              <span className="flex-1 font-mono text-sm" style={{ color: 'var(--txt)' }}>{selected}</span>
              {!editing ? (
                <button className="btn btn-sm" onClick={openEditor}>
                  <Edit2 size={12} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => updateMutation.mutate(editContent)}
                    disabled={updateMutation.isPending}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                className="btn btn-sm btn-pink"
                onClick={() => {
                  if (confirm(`Delete skill "${selected}"?`)) deleteMutation.mutate(selected)
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {editing ? (
                <textarea
                  className="w-full font-mono text-sm p-4 rounded border resize-none"
                  style={{
                    minHeight: '500px',
                    color: 'var(--txt)',
                    outline: 'none',
                    background: 'var(--bg)',
                    borderColor: 'var(--border)'
                  }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {detail?.skill_md && (
                    <div className="card">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen size={12} style={{ color: 'var(--cyan)' }} />
                        <span className="section-title">SKILL.md</span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap" style={{ color: 'var(--txt)' }}>
                        {detail.skill_md}
                      </pre>
                    </div>
                  )}
                  {detail?.readme && (
                    <div className="card">
                      <p className="section-title mb-2">README.md</p>
                      <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
                        {detail.readme}
                      </pre>
                    </div>
                  )}
                  {!detail?.skill_md && !detail?.readme && (
                    <div className="card text-center" style={{ padding: '2rem' }}>
                      <p className="text-sm text-muted">This skill has no content yet. Click Edit to add SKILL.md content.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="modal-overlay">
          <div className="modal" style={{ borderColor: 'rgba(5,217,232,0.3)' }}>
            <div className="modal-header">
              <span className="modal-title glow-cyan" style={{ color: 'var(--cyan)' }}>CREATE NEW SKILL</span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs mb-1 block text-muted">Skill Name</label>
                <input
                  className="input"
                  placeholder="my-awesome-skill"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block text-muted">Description</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="What does this skill do?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button className="btn flex-1" onClick={() => setCreating(false)}>Cancel</button>
                <button
                  className="btn flex-1"
                  style={{ borderColor: 'rgba(5,217,232,0.3)', color: 'var(--cyan)', background: 'rgba(5,217,232,0.05)' }}
                  onClick={() => createMutation.mutate()}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
