'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Settings, ChevronDown, ChevronRight, Cpu, Terminal, Palette, Volume2, Mic,
  Brain, Globe, Plug, Users, Shrink, Zap, Lock, Loader2, AlertTriangle,
} from 'lucide-react'
import { configApi } from '../lib/api'

const SECTION_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  model:       { label: 'Model',       icon: <Cpu size={13} />,       description: 'Default model and provider' },
  display:     { label: 'Display',     icon: <Palette size={13} />,   description: 'UI preferences and personality' },
  terminal:    { label: 'Terminal',    icon: <Terminal size={13} />,  description: 'Shell backend and timeouts' },
  tts:         { label: 'TTS',        icon: <Volume2 size={13} />,   description: 'Text-to-speech configuration' },
  stt:         { label: 'STT',        icon: <Mic size={13} />,       description: 'Speech-to-text configuration' },
  memory:      { label: 'Memory',     icon: <Brain size={13} />,     description: 'Memory and profile configuration' },
  browser:     { label: 'Browser',    icon: <Globe size={13} />,     description: 'Browser automation configuration' },
  mcp_servers: { label: 'MCP Servers',icon: <Plug size={13} />,      description: 'Model Context Protocol servers' },
  delegation:  { label: 'Delegation', icon: <Users size={13} />,     description: 'Sub-agent configuration' },
  compression: { label: 'Compression',icon: <Shrink size={13} />,   description: 'Context compression configuration' },
  cron:        { label: 'Cron',       icon: <Zap size={13} />,       description: 'Scheduled jobs configuration' },
  security:    { label: 'Security',   icon: <Lock size={13} />,      description: 'Security and redaction' },
}

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--muted)' }}>null</span>
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: value ? 'var(--primary)' : 'var(--pink)' }}>{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span style={{ color: 'var(--accent)' }}>{value}</span>
  }
  if (typeof value === 'string') {
    if (value === '••••••••') {
      return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>••••••••</span>
    }
    if (value === '') {
      return <span style={{ color: 'var(--muted)' }}>""</span>
    }
    return <span style={{ color: 'var(--primary)' }}>{value}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: 'var(--muted)' }}>[]</span>
    if (value.every(v => typeof v === 'string') && value.length <= 8) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border" style={{
              background: 'rgba(0,255,65,0.05)',
              borderColor: 'rgba(0,255,65,0.15)',
              color: 'var(--accent)',
            }}>
              {String(v)}
            </span>
          ))}
        </span>
      )
    }
    return (
      <div className="ml-3 space-y-0.5">
        {value.map((v, i) => (
          <div key={i} className="flex items-start gap-1">
            <span style={{ color: 'var(--muted)' }} className="text-[10px] mt-0.5">-</span>
            <span className="text-[11px] font-mono" style={{ color: 'var(--txt)' }}>{renderValue(v, depth + 1)}</span>
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span style={{ color: 'var(--muted)' }}>{'{}'}</span>
    return (
      <div className={depth > 0 ? 'ml-3' : ''}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-0.5">
            <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>{k}:</span>
            <div className="flex-1 min-w-0 text-[11px] font-mono" style={{ color: 'var(--txt)' }}>{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }
  return <span style={{ color: 'var(--muted)' }}>{String(value)}</span>
}

function ConfigSection({ sectionKey, data, defaultOpen = false }: {
  sectionKey: string
  data: Record<string, unknown>
  defaultOpen?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const meta = SECTION_META[sectionKey] || { label: sectionKey, icon: <Settings size={13} />, description: '' }
  const entryCount = Object.keys(data).length

  if (entryCount === 0) return null

  return (
    <div className="rounded border overflow-hidden" style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <span style={{ color: 'var(--accent)' }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--txt)' }}>{meta.label}</p>
          <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{meta.description}</p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>{entryCount}</span>
        <span style={{ color: 'var(--muted)' }}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 py-1">
              <span className="text-[11px] font-mono flex-shrink-0 min-w-[120px]" style={{ color: 'var(--muted)' }}>{k}:</span>
              <div className="flex-1 min-w-0 break-all" style={{ wordBreak: 'break-word' }}>{renderValue(v)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConfigPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['config'],
    queryFn: configApi.get,
    refetchInterval: 60000,
  })

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
          <p style={{ color: 'var(--txt)' }}>Failed to load configuration</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{String(error)}</p>
        </div>
      </div>
    )
  }

  const sections = data.sections || {}
  const sectionKeys = Object.keys(sections)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--accent)' }}>
          Config
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          Hermes configuration — secrets automatically redacted
          {data.configVersion && (
            <span> · v{data.configVersion}</span>
          )}
        </p>
      </div>

      <div className="grid gap-3">
        {sectionKeys.map(key => (
          <ConfigSection
            key={key}
            sectionKey={key}
            data={sections[key] as Record<string, unknown>}
            defaultOpen={false}
          />
        ))}
      </div>
    </div>
  )
}
