import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { logsApi } from '../lib/api'
import { FileText, RefreshCw, Search } from 'lucide-react'

const LOG_TYPES = [
  { id: 'gateway', label: 'Gateway' },
  { id: 'gateway_error', label: 'Gateway Error' },
  { id: 'errors', label: 'Errors' },
  { id: 'agent', label: 'Agent' },
]

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
  const LIMIT = 300
  const logBottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['logs', logType, offset, search],
    queryFn: () => logsApi.get(logType, offset, LIMIT, search || undefined),
    refetchInterval: 5000,
  })

  // Auto-scroll to bottom when new data arrives
  useEffect(() => {
    if (offset === 0) {
      logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [data, offset])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
  }, [])

  return (
    <div className="flex flex-col" style={{ height: '100%', padding: '1.5rem', gap: '1rem' }}>
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="font-display" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} />
          System Logs
        </h1>
        <button
          onClick={() => refetch()}
          className="btn btn-sm btn-ghost"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex gap-1">
          {LOG_TYPES.map(lt => (
            <button
              key={lt.id}
              onClick={() => { setLogType(lt.id); setOffset(0) }}
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
        </form>

        {data && (
          <span className="text-xs font-mono text-muted">
            {data.total_lines.toLocaleString()} total lines
          </span>
        )}
      </div>

      {/* Log viewer */}
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid var(--border)', background: '#050505' }}>
        <div style={{ height: '100%', overflowY: 'auto', padding: '0.75rem' }} ref={logBottomRef}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontFamily: 'monospace' }}>Loading...</div>
          ) : data?.lines.length === 0 ? (
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
        <div className="flex justify-center gap-4 items-center">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="btn btn-sm btn-ghost"
          >← Prev</button>
          <span className="text-sm font-mono text-muted">
            Showing {offset + 1}–{Math.min(offset + LIMIT, data.total_lines)} of {data.total_lines.toLocaleString()}
          </span>
          <button
            disabled={offset + LIMIT >= data.total_lines}
            onClick={() => setOffset(offset + LIMIT)}
            className="btn btn-sm btn-ghost"
          >Next →</button>
        </div>
      )}
    </div>
  )
}
