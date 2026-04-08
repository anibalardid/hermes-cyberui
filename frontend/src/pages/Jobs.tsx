'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, Zap, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Server, MessageSquare, Terminal, ChevronRight, ChevronDown,
  RefreshCw, Pause,
} from 'lucide-react'
import { jobsApi, type JobsFeed, type JobInfo, type SessionInfo } from '../lib/api'

const REFRESH_INTERVAL = 15000

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return `hace ${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `hace ${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `hace ${h}h`
    return `hace ${Math.floor(h / 24)}d`
  } catch { return '—' }
}

function sourceBadge(source: string): React.ReactNode {
  const colors: Record<string, string> = {
    cli: 'border-blue-400/30 text-blue-400 bg-blue-400/10',
    telegram: 'border-sky-400/30 text-sky-400 bg-sky-400/10',
    cron: 'border-amber-400/30 text-amber-400 bg-amber-400/10',
    discord: 'border-indigo-400/30 text-indigo-400 bg-indigo-400/10',
  }
  const cls = colors[source] || 'border-neutral-400/30 text-neutral-400 bg-neutral-400/10'
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>{source}</span>
}

function statusIcon(state: string, lastStatus: string | null): React.ReactNode {
  if (state === 'paused') return <Pause size={11} className="text-neutral-500" />
  if (lastStatus === 'error') return <XCircle size={11} className="text-red-400" />
  if (state === 'scheduled') return <Clock size={11} className="text-amber-400" />
  return <CheckCircle2 size={11} className="text-green-400" />
}

// ── Session Card ──────────────────────────────────────────────────────────
function SessionCard({ session }: { session: SessionInfo }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border overflow-hidden" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <span style={{ color: 'var(--muted)' }}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm truncate" style={{ color: 'var(--txt)' }}>{session.title}</span>
            {session.active
              ? <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-green-400/30 text-green-400 bg-green-400/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />ACTIVE
                </span>
              : null}
            {sourceBadge(session.source)}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
            <span>{session.message_count} msgs</span>
            <span>·</span>
            <span>{session.tool_call_count} tools</span>
            <span>·</span>
            <span>{formatDuration(session.duration_seconds)}</span>
            <span>·</span>
            <span>{session.model}</span>
          </div>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{timeAgo(session.started_at)}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <StatRow label="ID" value={session.id.slice(0, 12) + '…'} mono />
            <StatRow label="Started" value={new Date(session.started_at).toLocaleString('es-AR')} />
            <StatRow label="Messages" value={session.message_count} />
            <StatRow label="Tool calls" value={session.tool_call_count} />
            <StatRow label="Input tokens" value={session.input_tokens.toLocaleString()} />
            <StatRow label="Output tokens" value={session.output_tokens.toLocaleString()} />
            <StatRow label="Est. cost" value={`$${session.estimated_cost_usd.toFixed(6)}`} />
            <StatRow label="Duration" value={formatDuration(session.duration_seconds)} />
          </div>
          {session.ended_at && (
            <p className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
              Finalizado: {new Date(session.ended_at).toLocaleString('es-AR')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Job Card ─────────────────────────────────────────────────────────────
function JobCard({ job }: { job: JobInfo }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border overflow-hidden" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <span style={{ color: 'var(--muted)' }}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        {statusIcon(job.state, job.last_status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm truncate" style={{ color: 'var(--txt)' }}>{job.name}</span>
            {job.state === 'paused' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-400/30 text-neutral-400 bg-neutral-400/10">PAUSED</span>
            )}
            {job.last_status === 'error' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 bg-red-400/10">ERROR</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
            <Terminal size={9} />
            <span className="font-mono">{job.schedule}</span>
            {job.repeat_completed !== null && (
              <>
                <span>·</span>
                <span>{job.repeat_completed}
                  {job.repeat_times ? `/${job.repeat_times}` : ''} runs
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{timeAgo(job.last_run_at)}</p>
          {job.next_run_at && job.state !== 'paused' && (
            <p className="text-[9px]" style={{ color: 'var(--muted)' }}>
              {new Date(job.next_run_at).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <StatRow label="ID" value={job.id.slice(0, 12) + '…'} mono />
            <StatRow label="State" value={job.state} />
            <StatRow label="Enabled" value={job.enabled ? 'Yes' : 'No'} />
            <StatRow label="Last status" value={job.last_status || '—'} />
            <StatRow label="Last run" value={job.last_run_at ? timeAgo(job.last_run_at) : '—'} />
            <StatRow label="Next run" value={job.next_run_at ? new Date(job.next_run_at).toLocaleString('es-AR') : '—'} />
            {job.deliver && <StatRow label="Deliver" value={job.deliver} />}
            {job.model && <StatRow label="Model" value={job.model} />}
          </div>
          {job.last_error && (
            <div className="rounded p-2 text-[10px] border border-red-400/20 bg-red-400/5" style={{ color: 'var(--txt)' }}>
              <span style={{ color: 'var(--pink)' }}>Error:</span> {job.last_error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, mono }: { label: string; value: string | number | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      <span style={{ color: 'var(--muted)' }}>{label}:</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: 'var(--txt)' }}>{value ?? '—'}</span>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────
function Section({
  title, icon, count, children, accentColor
}: {
  title: string
  icon: React.ReactNode
  count?: number
  children: React.ReactNode
  accentColor?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded border" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <span style={{ color: accentColor || 'var(--accent)' }}>{icon}</span>
        <span className="text-sm font-bold uppercase tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: accentColor || 'var(--accent)' }}>{title}</span>
        {count !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>{count}</span>
        )}
        <span className="ml-auto" style={{ color: 'var(--muted)' }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {open && <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>{children}</div>}
    </div>
  )
}

// ── Summary Cards ─────────────────────────────────────────────────────────
function SummaryCards({ data }: { data: JobsFeed }) {
  const { summary, hermes } = data
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded border p-4" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Crons</span>
        </div>
        <p className="text-2xl font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--txt)' }}>{summary.total_jobs}</p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--muted)' }}>{summary.scheduled} activos · {summary.paused} pausados</p>
      </div>

      <div className="rounded border p-4" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={13} style={{ color: 'var(--primary)' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Sesiones</span>
        </div>
        <p className="text-2xl font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--txt)' }}>{summary.active_sessions}</p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--muted)' }}>+ {summary.recent_sessions} recientes</p>
      </div>

      <div className="rounded border p-4" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={13} style={{ color: 'var(--pink)' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Errores</span>
        </div>
        <p className="text-2xl font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: summary.errors > 0 ? 'var(--pink)' : 'var(--txt)' }}>{summary.errors}</p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--muted)' }}>jobs con error</p>
      </div>

      <div className="rounded border p-4" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Server size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Hermes</span>
        </div>
        <p className="text-sm font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: hermes.status === 'ok' ? 'var(--primary)' : 'var(--pink)' }}>
          {hermes.status || 'unknown'}
        </p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--muted)' }}>{hermes.platform || '—'}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function JobsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs-feed'],
    queryFn: jobsApi.feed,
    refetchInterval: REFRESH_INTERVAL,
  })

  const [autoRefresh, setAutoRefresh] = useState(true)

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={32} style={{ color: 'var(--pink)' }} className="mx-auto mb-2" />
          <p style={{ color: 'var(--txt)' }}>No se pudo cargar el Jobs Feed</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>¿Está Hermes corriendo?</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 rounded border text-xs" style={{ borderColor: 'var(--border)', color: 'var(--txt)' }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const { jobs, sessions } = data

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--accent)' }}>
            Jobs Feed
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Ultima actualizacion: {timeAgo(data.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
            style={{
              borderColor: autoRefresh ? 'var(--primary)' : 'var(--border)',
              color: autoRefresh ? 'var(--primary)' : 'var(--muted)',
              background: autoRefresh ? 'rgba(0,255,65,0.05)' : 'transparent',
            }}
          >
            <RefreshCw size={11} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--txt)' }}
          >
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </div>

      {/* Summary */}
      <SummaryCards data={data} />

      {/* Active Sessions */}
      {sessions.active.length > 0 && (
        <Section title="Sesiones Activas" icon={<Activity size={13} />} count={sessions.active.length} accentColor="var(--primary)">
          {sessions.active.map(s => <SessionCard key={s.id} session={s} />)}
        </Section>
      )}

      {/* Scheduled Jobs */}
      <Section title="Cron Jobs" icon={<Clock size={13} />} count={jobs.scheduled.length} accentColor="var(--accent)">
        {jobs.scheduled.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--muted)' }}>Sin jobs programados</p>
        ) : (
          jobs.scheduled.map(j => <JobCard key={j.id} job={j} />)
        )}
      </Section>

      {/* Paused Jobs */}
      {jobs.paused.length > 0 && (
        <Section title="Pausados" icon={<Pause size={13} />} count={jobs.paused.length} accentColor="var(--muted)">
          {jobs.paused.map(j => <JobCard key={j.id} job={j} />)}
        </Section>
      )}

      {/* Error Jobs */}
      {jobs.errors.length > 0 && (
        <Section title="Errores" icon={<AlertTriangle size={13} />} count={jobs.errors.length} accentColor="var(--pink)">
          {jobs.errors.map(j => <JobCard key={j.id} job={j} />)}
        </Section>
      )}

      {/* Recent Sessions */}
      {sessions.recent.length > 0 && (
        <Section title="Sesiones Recientes" icon={<MessageSquare size={13} />} count={sessions.recent.length} accentColor="var(--primary)">
          {sessions.recent.map(s => <SessionCard key={s.id} session={s} />)}
        </Section>
      )}
    </div>
  )
}
