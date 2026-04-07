import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { multiagentApi } from '../lib/api'
import { Bot, Plus, Pencil, Check, X, Save, Trash2 } from 'lucide-react'

const CHANNEL_OPTIONS = [
  { id: 'orchestrator', label: '#1-orchestrator' },
  { id: 'ideas', label: '#2-ideas' },
  { id: 'research_raw', label: '#3-research-raw' },
  { id: 'research_clean', label: '#4-research-clean' },
  { id: 'analysis', label: '#5-analysis' },
  { id: 'critic', label: '#6-critic' },
  { id: 'iteration', label: '#7-iteration' },
  { id: 'final', label: '#8-final' },
  { id: 'dev', label: '#9-dev' },
]

export default function Multiagent() {
  const qc = useQueryClient()
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [addingAgent, setAddingAgent] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', display_name: '', model: '', fallback: '', channel: '', description: '' })

  const { data: multiData, isLoading } = useQuery({
    queryKey: ['multiagent'],
    queryFn: async () => {
      const [config, agents] = await Promise.all([
        multiagentApi.config(),
        multiagentApi.agents(),
      ])
      return { config: config.config || {}, agents: agents.agents || [], state: agents.state }
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: (cfg: any) => multiagentApi.updateConfig(cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['multiagent'] }),
  })

  const agents: any[] = multiData?.agents || []

  function startEdit(agent: any) {
    setEditingAgent(agent.name)
    setEditForm({
      name: agent.name,
      display_name: agent.display_name,
      model: agent.model || '',
      fallback: agent.fallback || '',
      channel: agent.channel_name || agent.channel_id || '',
      description: agent.description || '',
    })
  }

  function saveEdit() {
    const current: any = multiData?.config || {}
    const agents = { ...(current.agents || {}) }
    const channels = current.channels || {}
    // Get channel id from channel name
    const channelId = editForm.channel
    agents[editForm.name] = {
      name: editForm.display_name,
      model: editForm.model,
      fallback: editForm.fallback,
      channel: channelId,
      description: editForm.description,
    }
    updateConfigMutation.mutate({ ...current, agents, channels })
    setEditingAgent(null)
    setEditForm({})
  }

  function startAdd() {
    setAddingAgent(true)
    setNewAgent({ name: '', display_name: '', model: '', fallback: '', channel: '', description: '' })
  }

  function saveAdd() {
    const current: any = multiData?.config || {}
    const agents = { ...(current.agents || {}), [newAgent.name]: {
      name: newAgent.display_name,
      model: newAgent.model,
      fallback: newAgent.fallback,
      channel: newAgent.channel,
      description: newAgent.description,
    }}
    updateConfigMutation.mutate({ ...current, agents, channels: current.channels || {} })
    setAddingAgent(false)
    setNewAgent({ name: '', display_name: '', model: '', fallback: '', channel: '', description: '' })
  }

  function deleteAgent(name: string) {
    const current: any = multiData?.config || {}
    const agents = { ...current.agents }
    delete agents[name]
    updateConfigMutation.mutate({ ...current, agents })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <div className="title-bar" />
          <div>
            <h1>MULTI-AGENT</h1>
            <p>Sub-agent configuration</p>
          </div>
        </div>
        <button className="btn btn-sm" onClick={startAdd}>
          <Plus size={14} /> Add Agent
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* System State */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} className="card">
            <span className="font-mono" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>System State:</span>
            <span className="font-mono" style={{ color: multiData?.state === 'IDLE' ? 'var(--primary)' : 'var(--warning)', fontWeight: 700 }}>
              {multiData?.state || 'UNKNOWN'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)' }}>{agents.length} agents</span>
          </div>

          {/* Add agent form */}
          {addingAgent && (
            <div className="card" style={{ border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Plus size={14} style={{ color: 'var(--primary)' }} />
                <span className="font-mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>NEW AGENT</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>AGENT KEY</label>
                  <input className="input" placeholder="e.g. analyst" value={newAgent.name}
                    onChange={e => setNewAgent({ ...newAgent, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>DISPLAY NAME</label>
                  <input className="input" placeholder="e.g. Analista" value={newAgent.display_name}
                    onChange={e => setNewAgent({ ...newAgent, display_name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>MODEL</label>
                  <input className="input" placeholder="e.g. qwen3.5" value={newAgent.model}
                    onChange={e => setNewAgent({ ...newAgent, model: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>FALLBACK</label>
                  <input className="input" placeholder="e.g. llama3" value={newAgent.fallback}
                    onChange={e => setNewAgent({ ...newAgent, fallback: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>CHANNEL</label>
                  <select className="select" value={newAgent.channel}
                    onChange={e => setNewAgent({ ...newAgent, channel: e.target.value })} style={{ width: '100%' }}>
                    <option value="">Select channel...</option>
                    {CHANNEL_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>DESCRIPTION</label>
                  <input className="input" placeholder="What this agent does" value={newAgent.description}
                    onChange={e => setNewAgent({ ...newAgent, description: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-sm" disabled={!newAgent.name || !newAgent.model} onClick={saveAdd}>
                  <Save size={12} /> Add
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setAddingAgent(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Agents grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {agents.map(agent => (
              <div key={agent.name} className="card" style={{ border: editingAgent === agent.name ? '1px solid var(--cyan)' : undefined }}>
                {editingAgent === agent.name && editForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Pencil size={14} style={{ color: 'var(--cyan)' }} />
                      <span className="font-mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>EDITING</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>MODEL</label>
                        <input className="input" value={editForm.model} onChange={e => setEditForm({...editForm, model: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>FALLBACK</label>
                        <input className="input" value={editForm.fallback} onChange={e => setEditForm({...editForm, fallback: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>CHANNEL</label>
                        <select className="select" value={editForm.channel} onChange={e => setEditForm({...editForm, channel: e.target.value})} style={{ width: '100%' }}>
                          <option value="">Select...</option>
                          {CHANNEL_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>DESCRIPTION</label>
                        <input className="input" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button className="btn btn-sm" onClick={saveEdit}><Check size={12} /> Save</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditingAgent(null)}><X size={12} /> Cancel</button>
                      <button className="btn btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => { deleteAgent(agent.name); setEditingAgent(null) }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Bot size={16} style={{ color: 'var(--pink)' }} />
                      <span className="font-mono fw-bold" style={{ color: 'var(--txt)' }}>{agent.display_name}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginLeft: 'auto' }}>#{agent.channel_name || agent.channel_id}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>{agent.description || 'No description'}</p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                      <span>Model: <span style={{ color: 'var(--primary)' }}>{agent.model}</span></span>
                      {agent.fallback && <span>Fallback: <span style={{ color: 'var(--muted)' }}>{agent.fallback}</span></span>}
                    </div>
                    <button className="btn btn-sm btn-ghost" style={{ marginTop: '0.75rem' }} onClick={() => startEdit(agent)}>
                      <Pencil size={12} /> Edit
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
