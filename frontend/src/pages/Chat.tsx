import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '../lib/api'
import { useIsMobile } from '../hooks/useIsMobile'
import { ArrowLeft, Send, Info, PanelRightClose, PanelRightOpen, Bot, User } from 'lucide-react'

const SIDEBAR_STORAGE_KEY = 'hermes-chat-sidebar-width'

function getStoredWidth(): number {
  try { return parseInt(localStorage.getItem(SIDEBAR_STORAGE_KEY) || '288', 10) } catch { return 288 }
}

export default function Chat() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(getStoredWidth)
  const [isResizing, setIsResizing] = useState(false)
  const isMobile = useIsMobile()
  const abortRef = useRef<AbortController | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const delta = e.clientX - resizeStartX.current
    const next = Math.max(200, Math.min(600, resizeStartWidth.current - delta))
    setSidebarWidth(next)
  }, [isResizing])

  const onMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth)) } catch {}
    }
  }, [isResizing, sidebarWidth])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    resizeStartX.current = e.clientX
    resizeStartWidth.current = sidebarWidth
    setIsResizing(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  const { data, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => sessionsApi.get(id!),
    enabled: !!id,
    refetchInterval: 5000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data, streamText])

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      setStreaming(true)
      setStreamText('')
      setError(null)
      abortRef.current = new AbortController()

      try {
        const response = await fetch(`/api/sessions/${id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (!response.body) throw new Error('No response body')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let done = false
        let acc = ''

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading
          if (value) {
            const chunk = decoder.decode(value, { stream: !done })
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6))
                  if (parsed.token) {
                    acc += parsed.token
                    setStreamText(acc)
                  }
                  if (parsed.done) done = true
                } catch { /* skip malformed */ }
              }
            }
          }
        }
        return acc
      } finally {
        setStreaming(false)
        setStreamText('')
        abortRef.current = null
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', id] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err: Error) => {
      setError(err.message)
      setStreaming(false)
      setStreamText('')
    },
  })

  const handleSend = () => {
    if (!input.trim() || streaming) return
    sendMutation.mutate(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const messages = data?.messages ?? []
  const recentMessages = messages.slice(-20)

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}
        >
          <Link to="/sessions" className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: 'var(--txt)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" style={{ color: 'var(--txt)', fontSize: '13px' }}>
              {messages[0]?.content?.slice(0, 60) || 'New Session'}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {messages.length} messages
              {streaming && (
                <span className="ml-2" style={{ color: 'var(--primary)' }}>● streaming</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: sidebarOpen ? 'var(--primary)' : 'var(--muted)' }}
            title={sidebarOpen ? 'Hide activity' : 'Show activity'}
          >
            {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--surf)' }} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.15)' }}
              >
                <Info size={24} style={{ color: 'var(--primary)' }} />
              </div>
              <p className="font-bold text-sm tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--primary)' }}>
                READY TO SERVE
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Type a message below to start the session.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className="space-y-1">
                  <div
                    className="text-xs px-1 font-display tracking-widest"
                    style={{ color: msg.role === 'user' ? 'var(--accent)' : 'var(--primary)' }}
                  >
                    {msg.role === 'user' ? 'USER' : msg.role === 'assistant' ? 'HERMES' : msg.role.toUpperCase()}
                  </div>
                  <div
                    className="rounded px-3 py-2"
                    style={{
                      background: msg.role === 'user' ? 'var(--msg-user-bg)' : 'var(--msg-assistant-bg)',
                      border: `1px solid ${msg.role === 'user' ? 'var(--msg-user-border)' : 'var(--msg-assistant-border)'}`,
                    }}
                  >
                    <p className="whitespace-pre-wrap" style={{ color: msg.role === 'user' ? 'var(--msg-user-text)' : 'var(--msg-assistant-text)', fontSize: '13px' }}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}

              {streaming && streamText && (
                <div className="space-y-1">
                  <div className="text-xs px-1 font-display tracking-widest" style={{ color: 'var(--primary)' }}>
                    HERMES
                  </div>
                  <div
                    className="rounded px-3 py-2"
                    style={{ background: 'var(--msg-assistant-bg)', border: '1px solid var(--msg-assistant-border)' }}
                  >
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--msg-assistant-text)', fontSize: '13px' }}>
                      {streamText}<span className="animate-pulse">▋</span>
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div
                  className="rounded px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,42,109,0.08)', border: '1px solid rgba(255,42,109,0.3)', color: 'var(--pink)' }}
                >
                  Error: {error}
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="p-4 border-t"
          style={{ background: 'var(--surf)', borderColor: 'var(--border)' }}
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm" style={{ color: 'var(--primary)' }}>
                &gt;_
              </span>
              <textarea
                className="w-full pl-10 pr-3 py-2.5 rounded font-mono text-sm resize-none"
                style={{
                  outline: 'none',
                  background: 'var(--surf)',
                  border: '1px solid var(--border)',
                  color: 'var(--txt)',
                  minHeight: '42px',
                  maxHeight: '120px',
                }}
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={streaming}
              />
            </div>
            {streaming ? (
              <button
                className="px-3 rounded font-mono text-sm border transition-colors"
                style={{ borderColor: 'var(--pink)', color: 'var(--pink)' }}
                onClick={handleStop}
              >
                STOP
              </button>
            ) : (
              <button
                className="px-3 rounded transition-colors"
                style={{ background: 'var(--primary)', color: '#000' }}
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      {sidebarOpen && (
        <div
          className="shrink-0 flex flex-col border-l relative"
          style={{
            width: sidebarWidth,
            background: 'var(--surf)',
            borderColor: 'var(--border)',
            cursor: isResizing ? 'ew-resize' : undefined,
          }}
        >
          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute left-0 top-0 bottom-0 w-1 hover:w-1.5 transition-all"
            style={{
              cursor: 'ew-resize',
              background: isResizing ? 'var(--primary)' : 'transparent',
              zIndex: 10,
            }}
            title="Drag to resize"
          />

          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif', color: 'var(--accent)' }}>
              Activity
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: isMobile ? '0.5rem' : '0.25rem', display: 'flex', alignItems: 'center', fontSize: isMobile ? '1.25rem' : '0.875rem' }}
              aria-label="Close activity sidebar"
            >
              <PanelRightClose size={isMobile ? 18 : 14} />
            </button>
          </div>

          {/* Activity feed */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ minHeight: 0 }}>
            {recentMessages.map((msg, i) => (
              <div
                key={i}
                className="p-2 rounded text-xs"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {msg.role === 'user' ? (
                    <User size={10} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Bot size={10} style={{ color: 'var(--primary)' }} />
                  )}
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{ color: msg.role === 'user' ? 'var(--accent)' : 'var(--primary)', fontSize: '10px' }}
                  >
                    {msg.role}
                  </span>
                  <span className="ml-auto" style={{ color: 'var(--muted)', fontSize: '9px' }}>
                    {new Date((msg as any).timestamp || Date.now()).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="line-clamp-3 leading-relaxed" style={{ color: 'var(--txt)' }}>
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
