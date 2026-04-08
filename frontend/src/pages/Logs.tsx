import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { logsApi } from '../lib/api'
import { FileText, RefreshCw, Search, Play, Pause, ArrowDown } from 'lucide-react'

const LOG_TYPES = [
  { id: 'gateway', label: 'Gateway' },
  { id: 'gateway_error', label: 'Gateway Error' },
  { id: 'errors', label: 'Errors' },
  { id: 'agent', label: 'Agent' },
]

const AUTO_REFRESH_KEY = 'hermes-logs-auto-refresh'
const VIEW_ANCHOR_KEY = 'hermes-logs-anchor'
const LIMIT = 300

function LogLine({ line, index }: { line: string; index: number }) {
  const isError = /\b(ERROR|FATAL|CRITICAL)\b/i.test(line)
  const isWarn = /\b(WARN|WARNING)\b/i.test(line)
  const isInfo = /\bINFO\b/i.test(line)

  let color = 'var(--txt)'
  if (isError) color = '#ff6b6b'
  else if (isWarn) color = '#f5d400'
  else if (isInfo) color = 'var(--cyan)'

  return (
    <div className="flex gap-2 py-0.5 font-mono text-xs" style={{ color }}>
      <span className="text-muted shrink-0 text-right" style={{ width: '2.5rem', flexShrink: 0 }}>{index + 1}</span>
      <span className="word-break" style={{ overflowWrap: 'break-word' }}>{line}</span>
    </div>
  )
}

export default function Logs() {
  const [logType, setLogType] = useState('gateway')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  // Default to 'true' if not yet set in localStorage
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const stored = localStorage.getItem(AUTO_REFRESH_KEY)
    return stored === null ? true : stored === 'true'
  })
  // 'end' = live tail, 'start' = manual pagination
  const [viewAnchor, setViewAnchor] = useState<'end' | 'start'>(() => {
    return (localStorage.getItem(VIEW_ANCHOR_KEY) as 'end' | 'start') || 'end'
  })

  // Ref for the scrollable inner div
  const scrollRef = useRef<HTMLDivElement>(null)
  // Track previous line count to know when new content arrived
  const prevLineCountRef = useRef<number>(0)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['logs', logType, offset, search],
    queryFn: () => logsApi.get(logType, offset, LIMIT, search || undefined),
    refetchInterval: autoRefresh ? 3000 : false,
  })

  // Correct offset to tail on first mount of this log type
  useEffect(() => {
    if (viewAnchor === 'end' && data?.total_lines != null) {
      setOffset(Math.max(0, data.total_lines - LIMIT))
    }
  }, [viewAnchor]) // only when viewAnchor changes

  // Scroll to bottom whenever new lines arrive AND we're in live mode
  useEffect(() => {
    if (viewAnchor !== 'end') return
    if (!data?.lines?.length) return

    const newCount = data.lines.length
    const prevCount = prevLineCountRef.current
    prevLineCountRef.current = newCount

    // Only scroll if we got new content (either initial load or live refresh added lines)
    if (prevCount === 0 || newCount !== prevCount) {
      // Defer to next tick so React has finished the DOM update
      setTimeout(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, 0)
    }
  }, [data, viewAnchor])

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_KEY, String(autoRefresh))
  }, [autoRefresh])

  useEffect(() => {
    localStorage.setItem(VIEW_ANCHOR_KEY, viewAnchor)
  }, [viewAnchor])

  const goToEnd = useCallback(() => {
    if (data?.total_lines) {
      setOffset(Math.max(0, data.total_lines - LIMIT))
      setViewAnchor('end')
    }
  }, [data])

  const handleLogTypeChange = useCallback((type: string) => {
    setLogType(type)
    setSearch('')
    setOffset(0)
    setViewAnchor('end')
    prevLineCountRef.current = 0
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setViewAnchor('end')
  }, [])

  const totalLines = data?.total_lines ?? 0
  const showingEnd = Math.min(offset + LIMIT, totalLines)

  return (
    <div className="flex flex-col" style={{ height: '100%', padding: '1.5rem', gap: '1rem' }}>
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="font-display" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} />
          System Logs
        </h1>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(v => !v)}
          className="btn btn-sm"
          style={autoRefresh
            ? { background: 'rgba(0,255,65,0.15)', borderColor: 'var(--primary)', color: 'var(--primary)' }
            : { borderColor: 'var(--border)', color: 'var(--muted)' }
          }
          title={autoRefresh ? 'Auto-refresh ON (every 3s)' : 'Auto-refresh OFF'}
        >
          {autoRefresh ? <Pause size={14} /> : <Play size={14} />}
          {autoRefresh ? 'Live' : 'Paused'}
        </button>

        <button onClick={() => refetch()} className="btn btn-sm btn-ghost">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>

        <button onClick={goToEnd} className="btn btn-sm btn-ghost" title="Jump to latest entries">
          <ArrowDown size={14} />
          Latest
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex gap-1">
          {LOG_TYPES.map(lt => (
            <button
              key={lt.id}
              onClick={() => handleLogTypeChange(lt.id)}
              className="btn btn-sm"
              style={logType === lt.id
                ? { background: 'var(--primary)', color: '#000', borderColor: 'var(--primary)' }
                : { borderColor: 'var(--border)', color: 'var(--txt)' }
              }
            >
              {lt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1" style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '32rem', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '0.375rem' }}>
            <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search (regex supported)..."
              className="flex-1"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--txt)', fontSize: '0.875rem', fontFamily: 'inherit' }}
            />
          </div>
          <button type="submit" className="btn btn-sm btn-primary">Search</button>
          {search && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSearch(''); setViewAnchor('end'); setOffset(0) }}>
              Clear
            </button>
          )}
        </form>

        {data && (
          <span className="text-xs font-mono text-muted">
            {totalLines.toLocaleString()} total lines
            {search ? ` (${data.lines.length} match${data.lines.length !== 1 ? 'es' : ''})` : ''}
          </span>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--muted)' }}>
        {viewAnchor === 'end' ? (
          <span style={{ color: 'var(--primary)' }}>
            Last {data?.lines?.length ?? 0} entries
            {isFetching && <span> — refreshing...</span>}
          </span>
        ) : (
          <span>
            Showing {offset + 1}–{showingEnd} of {totalLines.toLocaleString()}
          </span>
        )}
      </div>

      {/* Log viewer */}
      <div style={{ maxHeight: 'calc(100vh - 19rem)', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid var(--border)', background: '#050505', flexShrink: 0 }}>
        <div
          ref={scrollRef}
          style={{ height: '100%', overflowY: 'auto', padding: '0.75rem' }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontFamily: 'monospace' }}>Loading...</div>
          ) : data?.lines?.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontFamily: 'monospace' }}>No log entries found</div>
          ) : (
            data?.lines.map((line: string, i: number) => (
              <LogLine key={i} line={line} index={offset + i} />
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.total_lines > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', flexWrap: 'wrap' }}>
          <button
            disabled={offset === 0}
            onClick={() => { setOffset(Math.max(0, offset - LIMIT)); setViewAnchor('start') }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
              fontSize: '0.8rem', background: 'transparent',
              border: '1px solid var(--border)', cursor: 'pointer',
              color: offset === 0 ? 'var(--muted)' : 'var(--txt)',
              opacity: offset === 0 ? 0.5 : 1,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--muted)', minWidth: '80px', textAlign: 'center' }}>
            {offset + 1}–{showingEnd} / {data.total_lines.toLocaleString()}
          </span>
          <button
            disabled={offset + LIMIT >= data.total_lines}
            onClick={() => { setOffset(offset + LIMIT); setViewAnchor('start') }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
              fontSize: '0.8rem', background: 'transparent',
              border: '1px solid var(--border)', cursor: 'pointer',
              color: offset + LIMIT >= data.total_lines ? 'var(--muted)' : 'var(--txt)',
              opacity: offset + LIMIT >= data.total_lines ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
