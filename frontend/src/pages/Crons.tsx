import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cronsApi } from '../lib/api'
import { Clock, Play, Pause, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle, FileText, Eye, X } from 'lucide-react'
import type { CronJob } from '../lib/api'

export default function Crons() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewingJob, setViewingJob] = useState<CronJob | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['crons'],
    queryFn: cronsApi.list,
  })

  const updateMutation = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: any }) =>
      cronsApi.update(jobId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crons'] }),
  })

  const runNowMutation = useMutation({
    mutationFn: (jobId: string) => cronsApi.runNow(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crons'] }),
  })

  const { data: jobDetail } = useQuery({
    queryKey: ['cron-detail', viewingJob?.id],
    queryFn: () => cronsApi.get(viewingJob!.id),
    enabled: !!viewingJob,
  })

  const jobs: any[] = data?.jobs ?? []

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      })
    } catch { return '—' }
  }

  const getRepeatText = (repeat: any) => {
    if (!repeat) return '—'
    if (repeat.times === null) return `${repeat.completed ?? 0} runs`
    return `${repeat.completed ?? 0}/${repeat.times}`
  }

  const getStatusColor = (status: string | null) => {
    if (status === 'ok') return '#00ff41'
    if (status === 'error') return '#ff2a6d'
    if (status === 'running') return '#f5d400'
    return '#6b7280'
  }

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ width: 4, height: '2rem', background: '#d400ff', borderRadius: 2, boxShadow: '0 0 12px rgba(212,0,255,0.6)' }} />
        <div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#d400ff', textShadow: '0 0 8px rgba(212,0,255,0.4)', margin: 0 }}>CRONS</h1>
          <p style={{ fontSize: '0.7rem', color: '#6b6b8a', margin: '2px 0 0' }}>{jobs.length} scheduled job{jobs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '5rem', borderRadius: '0.5rem', background: 'linear-gradient(90deg, var(--surf) 25%, var(--border) 50%, var(--surf) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '2.5rem', textAlign: 'center' }}>
          <Clock size={32} style={{ color: 'var(--border)', margin: '0 auto 0.75rem', display: 'block' }} />
          <p style={{ color: '#6b6b8a', margin: 0 }}>No cron jobs configured.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {jobs.map((job) => {
            const isOpen = expanded === job.id
            const isEnabled = !!job.enabled
            const statusColor = getStatusColor(job.last_status)

            return (
              <div key={job.id} style={{ background: 'var(--surf)', border: `1px solid ${isEnabled ? 'rgba(212,0,255,0.3)' : 'var(--border)'}`, borderRadius: '0.5rem', overflow: 'hidden' }}>
                {/* Row header — clickable */}
                <button
                  onClick={() => setExpanded(isOpen ? null : job.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem', width: '100%', background: 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem',
                    background: isEnabled ? 'rgba(212,0,255,0.08)' : 'rgba(107,114,128,0.08)',
                    border: `1px solid ${isEnabled ? 'rgba(212,0,255,0.25)' : 'rgba(107,114,128,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Clock size={12} style={{ color: isEnabled ? '#d400ff' : '#6b7280' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 500, color: isEnabled ? '#d400ff' : '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.name}
                    </p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#6b6b8a', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.schedule}{job.deliver ? ` — ${job.deliver}` : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    {job.last_status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {job.last_status === 'ok' && <CheckCircle size={12} style={{ color: statusColor }} />}
                        {job.last_status === 'error' && <XCircle size={12} style={{ color: statusColor }} />}
                        {job.last_status === 'running' && <AlertTriangle size={12} style={{ color: statusColor }} />}
                      </div>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                      borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
                      background: isEnabled ? 'rgba(0,255,65,0.1)' : 'rgba(107,114,128,0.1)',
                      color: isEnabled ? '#00ff41' : '#6b7280',
                      border: `1px solid ${isEnabled ? 'rgba(0,255,65,0.3)' : 'rgba(107,114,128,0.3)'}`
                    }}>
                      {isEnabled ? 'active' : 'paused'}
                    </span>
                    {isOpen
                      ? <ChevronDown size={14} style={{ color: '#6b7280' }} />
                      : <ChevronRight size={14} style={{ color: '#6b7280' }} />
                    }
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b6b8a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Next Run</p>
                        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#05d9e8' }}>{formatDate(job.next_run_at)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b6b8a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Last Run</p>
                        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#6b6b8a' }}>{formatDate(job.last_run_at)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b6b8a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Status</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {job.last_status === 'ok' && <CheckCircle size={10} style={{ color: '#00ff41' }} />}
                          {job.last_status === 'error' && <XCircle size={10} style={{ color: '#ff2a6d' }} />}
                          {job.last_status === 'running' && <AlertTriangle size={10} style={{ color: '#f5d400' }} />}
                          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: statusColor }}>{job.last_status ?? 'unknown'}</p>
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b6b8a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Repeat</p>
                        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#6b6b8a' }}>{getRepeatText(job.repeat)}</p>
                      </div>
                    </div>

                    {job.last_error && (
                      <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.25rem', background: 'rgba(255,42,109,0.05)', border: '1px solid rgba(255,42,109,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <AlertTriangle size={10} style={{ color: '#ff2a6d', flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#ff2a6d', margin: 0 }}>{job.last_error}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setViewingJob(job)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '0.375rem', fontSize: '0.8rem', background: 'rgba(212,0,255,0.08)', color: '#d400ff', border: '1px solid rgba(212,0,255,0.3)', cursor: 'pointer' }}
                      >
                        <Eye size={11} />Ver contenido
                      </button>
                      <button
                        onClick={() => runNowMutation.mutate(job.id)}
                        disabled={runNowMutation.isPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '0.375rem', fontSize: '0.8rem', background: '#05d9e8', color: '#000', border: '1px solid #05d9e8', cursor: 'pointer' }}
                      >
                        <Play size={11} />Run Now
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ jobId: job.id, data: { enabled: !isEnabled } })}
                        disabled={updateMutation.isPending}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '6px 12px', borderRadius: '0.375rem', fontSize: '0.8rem',
                          background: isEnabled ? 'rgba(255,42,109,0.05)' : 'rgba(0,255,65,0.05)',
                          color: isEnabled ? '#ff2a6d' : '#00ff41',
                          border: `1px solid ${isEnabled ? 'rgba(255,42,109,0.3)' : 'rgba(0,255,65,0.3)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {isEnabled ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Resume</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {viewingJob && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setViewingJob(null)}>
          <div style={{
            background: 'var(--surf)', border: '1px solid var(--border)', borderRadius: '0.75rem',
            width: '100%', maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={16} style={{ color: '#d400ff' }} />
                <div>
                  <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: '#d400ff', margin: 0 }}>{jobDetail?.name ?? viewingJob.name}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '2px 0 0' }}>{viewingJob.schedule}</p>
                </div>
              </div>
              <button onClick={() => setViewingJob(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            {/* Modal content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {jobDetail?.script ? (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>Script</p>
                  <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.75rem', color: '#00ff41', overflowX: 'auto', margin: 0 }}>{jobDetail.script}</pre>
                </div>
              ) : null}
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>Prompt</p>
                <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--txt)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {(jobDetail?.prompt ?? viewingJob.prompt ?? '').trim() || 'Sin prompt configurado.'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
