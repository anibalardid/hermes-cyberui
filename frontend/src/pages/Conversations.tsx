import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '../lib/api'
import type { Session, Message } from '../lib/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  MessageCircle, Hash, Send, Terminal,
  User, Bot, Wrench, Loader2, Search, Trash2, PlusCircle, StopCircle, AlertTriangle,
  PanelRightClose, Eye, Zap, FileText, Activity
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Channel {
  id: string
  name: string
  platform: string
  sessions: Session[]
  lastUpdated: string
  totalMessages: number
}

interface ConversationGroup {
  id: string
  title: string
  lastMessage: string
  lastUpdated: string
  messageCount: number
  platform: string
  sessionId: string
}

// ── Platform Styles ────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, { color: string; bg: string; label: string; icon: typeof Hash }> = {
  telegram: { color: '#05d9e8', bg: 'rgba(5,217,232,0.12)', label: 'Telegram', icon: MessageCircle },
  discord: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Discord', icon: Hash },
  cli: { color: '#00ff41', bg: 'rgba(0,255,65,0.10)', label: 'CLI', icon: Terminal },
  web: { color: '#ffb000', bg: 'rgba(255,176,0,0.10)', label: 'Web', icon: MessageCircle },
  api_server: { color: '#d400ff', bg: 'rgba(212,0,255,0.10)', label: 'API/WEB', icon: Terminal },
}

function getPlatformStyle(platform: string | null) {
  return PLATFORM_STYLES[(platform || 'cli').toLowerCase()] || { color: '#00ff41', bg: 'rgba(0,255,65,0.10)', label: platform || 'CLI', icon: Terminal }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isSystemMessage(msg: Message): boolean {
  return msg.role === 'system' || (msg.role === 'user' && (msg.content || '').trim().startsWith('[System:'))
}

function renderMarkdown(text: string): string {
  try {
    const rawHtml = marked.parse(text, { async: false, breaks: true, gfm: true }) as string
    return DOMPurify.sanitize(rawHtml)
  } catch {
    return DOMPurify.sanitize(text)
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function extractChannelName(session: Session): string {
  const title = session.title || ''
  // For sessions with titles like "[Anibal] topic", extract the topic
  if (title.startsWith('[Anibal]')) return title.slice(8).trim().slice(0, 60)
  if (title.startsWith('[Anibal ')) {
    const end = title.indexOf(']')
    if (end > 0) return title.slice(end + 1).trim().slice(0, 60)
  }
  return title.trim().slice(0, 60) || session.id
}

// ── Conversation List (left panel) ─────────────────────────────────────────

function ChannelList({ channels, selectedChannelId, onSelect }: {
  channels: Channel[]
  selectedChannelId: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search.trim()) return channels
    const q = search.toLowerCase()
    return channels.filter(c => c.name.toLowerCase().includes(q) || c.platform.toLowerCase().includes(q))
  }, [channels, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter channels..."
            className="input"
            style={{ paddingLeft: '1.75rem', fontSize: '0.8rem' }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
            No channels found
          </div>
        )}
        {filtered.map(ch => {
          const style = getPlatformStyle(ch.platform)
          const isSelected = ch.id === selectedChannelId
          const Icon = style.icon
          return (
            <div
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 0.75rem', cursor: 'pointer',
                background: isSelected ? `${style.bg}` : 'transparent',
                borderLeft: isSelected ? `3px solid ${style.color}` : `3px solid ${style.color}44`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surf)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={14} style={{ color: style.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--txt)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span>{style.label}</span>
                  <span>{ch.totalMessages} msgs</span>
                  <span>{relativeTime(ch.lastUpdated)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Conversation List (center panel — sessions within a channel) ───────────

function ConversationList({ conversations, selectedSessionId, onSelect, channelName }: {
  conversations: ConversationGroup[]
  selectedSessionId: string | null
  onSelect: (id: string) => void
  channelName: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
          Conversations
        </div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {channelName}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
            No conversations
          </div>
        )}
        {conversations.map(conv => {
          const isSelected = conv.sessionId === selectedSessionId
          return (
            <div
              key={conv.sessionId}
              onClick={() => onSelect(conv.sessionId)}
              style={{
                padding: '0.6rem 0.75rem', cursor: 'pointer',
                background: isSelected ? 'rgba(0,255,65,0.06)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surf)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: '0.82rem', color: 'var(--txt)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.title}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                {conv.lastMessage}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.2rem', display: 'flex', gap: '0.4rem' }}>
                <span>{conv.messageCount} msgs</span>
                <span>{relativeTime(conv.lastUpdated)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Activity Sidebar (right panel — shows all messages including tool calls) ──

// Icon and color mapping for different message roles in the activity sidebar
const ROLE_STYLES: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
  user:      { icon: User,     color: '#05d9e8', bg: 'rgba(5,217,232,0.08)',  label: 'User' },
  assistant: { icon: Bot,      color: '#00ff41', bg: 'rgba(0,255,65,0.06)',   label: 'Assistant' },
  system:    { icon: AlertTriangle, color: '#ffb000', bg: 'rgba(255,176,0,0.08)', label: 'System' },
  tool:      { icon: Wrench,   color: '#d400ff', bg: 'rgba(212,0,255,0.08)',  label: 'Tool' },
}

function ActivitySidebar({ messages, streaming, streamText }: { messages: Message[]; streaming: boolean; streamText: string }) {
  const activityRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or stream updates
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [messages.length, streamText])

  // Classify tool messages by content pattern
  function classifyToolContent(content: string): { icon: typeof Activity; label: string; color: string } {
    const lower = (content || '').toLowerCase()
    // Detect common tool patterns
    if (lower.includes('read') || lower.includes('reading') || lower.includes('file')) {
      return { icon: FileText, label: 'File Read', color: '#8b5cf6' }
    }
    if (lower.includes('write') || lower.includes('wrote') || lower.includes('created') || lower.includes('patch')) {
      return { icon: FileText, label: 'File Write', color: '#00ff41' }
    }
    if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) {
      return { icon: Search, label: 'Search', color: '#05d9e8' }
    }
    if (lower.includes('terminal') || lower.includes('command') || lower.includes('exec')) {
      return { icon: Terminal, label: 'Terminal', color: '#ffb000' }
    }
    if (lower.includes('browser') || lower.includes('navigate') || lower.includes('click')) {
      return { icon: Eye, label: 'Browser', color: '#05d9e8' }
    }
    if (lower.includes('delegat') || lower.includes('subagent')) {
      return { icon: Zap, label: 'Delegate', color: '#d400ff' }
    }
    return { icon: Wrench, label: 'Tool Call', color: '#d400ff' }
  }

  // Truncate content for display
  function truncateContent(content: string, maxLen: number = 180): string {
    if (!content) return '(empty)'
    const lines = content.split('\n')
    if (lines.length > 5) {
      return lines.slice(0, 5).join('\n') + `\n... (+${lines.length - 5} more lines)`
    }
    if (content.length > maxLen) {
      return content.slice(0, maxLen) + '...'
    }
    return content
  }

  return (
    <div
      ref={activityRef}
      style={{
        flex: 1, overflowY: 'auto', padding: '0.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.35rem',
      }}
    >
      {messages.length === 0 && !streaming && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', padding: '1.5rem 0.5rem' }}>
          No activity yet
        </div>
      )}
      {messages.map((msg, i) => {
        const roleStyle = ROLE_STYLES[msg.role] || ROLE_STYLES.tool
        const Icon = msg.role === 'tool' ? classifyToolContent(msg.content).icon : roleStyle.icon
        const color = msg.role === 'tool' ? classifyToolContent(msg.content).color : roleStyle.color
        const label = msg.role === 'tool' ? classifyToolContent(msg.content).label : roleStyle.label
        const isSystem = msg.role === 'system'
        const content = isSystem ? (msg.content || '').replace(/^\[System:\s*/i, '').trim() : (msg.content || '(empty)')

        return (
          <div
            key={i}
            style={{
              padding: '0.4rem 0.5rem',
              background: roleStyle.bg,
              border: `1px solid ${color}33`,
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
              <Icon size={11} style={{ color, flexShrink: 0 }} />
              <span style={{ color, fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </span>
              {msg.model && (
                <span style={{ color: 'var(--muted)', fontSize: '0.62rem', marginLeft: 'auto' }}>
                  {msg.model}
                </span>
              )}
            </div>
            <div
              style={{
                color: msg.role === 'tool' ? color : isSystem ? 'var(--muted)' : 'var(--txt)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                fontSize: '0.72rem',
                lineHeight: 1.45,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
              {...(msg.role === 'assistant' ? { dangerouslySetInnerHTML: { __html: renderMarkdown(truncateContent(content, 300)) } } : {})}
            >
              {msg.role !== 'assistant' ? truncateContent(content, 250) : null}
            </div>
          </div>
        )
      })}
      {/* Live streaming indicator in activity sidebar */}
      {streaming && (
        <div style={{
          padding: '0.4rem 0.5rem',
          background: 'rgba(0,255,65,0.06)',
          border: '1px solid rgba(0,255,65,0.2)',
          borderRadius: '0.375rem',
          fontSize: '0.72rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
            <Loader2 size={11} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {streamText ? 'Streaming' : 'Thinking'}
            </span>
          </div>
          {streamText && (
            <div
              className="response-markdown"
              style={{ color: '#c0f0c0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '100px', overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(truncateContent(streamText, 300)) }}
            />
          )}
          {!streamText && (
            <span className="animate-pulse" style={{ color: 'var(--muted)' }}>Waiting for response...</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Chat View (right panel — message bubbles + input) ─────────────────────────

function ChatView({ session, onDelete, onMessageSent }: { session: ConversationGroup | null; onDelete: () => void; onMessageSent: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['session-messages', session?.sessionId],
    queryFn: () => sessionsApi.get(session!.sessionId),
    enabled: !!session?.sessionId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Cleanup stream + reset state when switching sessions
  // Check for active stream FIRST — if found, reconnect seamlessly without flashing
  useEffect(() => {
    // Abort any in-flight stream from a previous session
    abortRef.current?.abort()
    abortRef.current = null
    setPendingUserMsg(null)
    setError(null)
    setDeleteConfirm(false)

    if (!session?.sessionId) {
      // No session selected — reset everything
      setStreaming(false)
      setStreamText('')
      return
    }

    let cancelled = false

    const checkAndReconnect = async () => {
      try {
        const resp = await fetch(`/api/sessions/${session.sessionId}/stream`)
        if (cancelled) return

        if (resp.status === 200 && resp.headers.get('content-type')?.includes('text/event-stream')) {
          // Active stream found — show thinking indicator immediately, no flash
          setStreaming(true)
          setStreamText('')
          const reader = resp.body?.getReader()
          if (!reader) { setStreaming(false); return }
          const decoder = new TextDecoder()
          let acc = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done || cancelled) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.reconnect) {
                  acc = parsed.text || ''
                  setStreamText(acc)
                } else if (parsed.token) {
                  acc += parsed.token
                  setStreamText(acc)
                } else if (parsed.done) {
                  setStreaming(false)
                  setStreamText('')
                  qc.invalidateQueries({ queryKey: ['session-messages', session.sessionId] })
                  qc.invalidateQueries({ queryKey: ['sessions'] })
                  onMessageSent()
                  return
                } else if (parsed.error) {
                  setError(parsed.error)
                }
              } catch { /* skip malformed */ }
            }
          }
          // Stream ended without done — refresh data
          if (!cancelled) {
            setStreaming(false)
            setStreamText('')
            qc.invalidateQueries({ queryKey: ['session-messages', session.sessionId] })
          }
        } else {
          // No active stream — reset streaming state
          if (!cancelled) { setStreaming(false); setStreamText('') }
        }
      } catch {
        // Not an active stream — that's fine, just reset
        if (!cancelled) { setStreaming(false); setStreamText('') }
      }
    }

    checkAndReconnect()
    return () => { cancelled = true; abortRef.current?.abort() }
  }, [session?.sessionId])

  useEffect(() => {
    if (data?.messages) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [data?.messages?.length])

  useEffect(() => {
    if (streamText) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [streamText])

  const handleSend = useCallback(async () => {
    const msg = input.trim()
    if (!msg || !session?.sessionId || streaming) return
    setInput('')
    setPendingUserMsg(msg)
    setStreaming(true)
    setStreamText('')
    setError(null)
    abortRef.current = new AbortController()

    try {
      const response = await fetch(`/api/sessions/${session.sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
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
                if (parsed.error) {
                  setError(parsed.error)
                }
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
      // Invalidate to refresh messages
      qc.invalidateQueries({ queryKey: ['session-messages', session.sessionId] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      onMessageSent()
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to send message')
      }
    } finally {
      setStreaming(false)
      setStreamText('')
      setPendingUserMsg(null)
      abortRef.current = null
    }
  }, [input, session?.sessionId, streaming, qc, onMessageSent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  if (!session) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
        Select a conversation to view messages
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  const messages = data?.messages || []

  // When pendingUserMsg is set, we optimistically show the user's message.
  // If the server data also includes that same user message (race condition),
  // filter it out to avoid showing the message twice.
  const chatMessages = messages
    .filter((m: Message) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .filter((m: Message) => {
      // Hide empty system messages (metadata-only, no real content)
      if (m.role === 'system' && !(m.content || '').trim()) return false
      if (!pendingUserMsg) return true
      // Hide user message if it matches the optimistic one we're already showing
      if (m.role === 'user' && m.content?.trim() === pendingUserMsg.trim()) return false
      return true
    })
  const toolMessages = messages.filter((m: Message) => m.role === 'tool')
  const activityMessages = messages.filter((m: Message) => {
    // Show all messages in the activity sidebar, including tool messages
    // but filter out empty system messages
    if (m.role === 'system' && !(m.content || '').trim()) return false
    return true
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {session.messageCount} messages {toolMessages.length > 0 ? `(+ ${toolMessages.length} tool calls)` : ''}
          </div>
        </div>
        {/* Activity sidebar toggle */}
        <button
          onClick={() => setShowActivity(!showActivity)}
          title={showActivity ? 'Hide Activity' : 'Show Activity'}
          style={{
            background: showActivity ? 'rgba(0,255,65,0.08)' : 'transparent',
            border: `1px solid ${showActivity ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '0.375rem',
            padding: '0.35rem 0.55rem',
            color: showActivity ? 'var(--primary)' : 'var(--muted)',
            cursor: 'pointer', fontSize: '0.7rem',
            display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s',
          }}
        >
          <Activity size={13} />
          {toolMessages.length > 0 && (
            <span style={{
              background: 'var(--pink)', color: 'white', borderRadius: '0.5rem',
              padding: '0 0.3rem', fontSize: '0.62rem', fontWeight: 700, lineHeight: '1.3rem',
            }}>
              {toolMessages.length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            if (deleteConfirm) {
              // Second click — actually delete
              sessionsApi.delete(session!.sessionId).then(() => {
                setToast({ msg: 'Session deleted', ok: true })
                qc.invalidateQueries({ queryKey: ['sessions'] })
                onDelete()
              }).catch(() => {
                setToast({ msg: 'Failed to delete session', ok: false })
              })
              setDeleteConfirm(false)
              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
            } else {
              // First click — ask for confirmation
              setDeleteConfirm(true)
              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
              deleteTimerRef.current = setTimeout(() => setDeleteConfirm(false), 3000)
            }
          }}
          style={{
            background: deleteConfirm ? 'rgba(255,0,65,0.15)' : 'transparent',
            border: `1px solid ${deleteConfirm ? 'var(--pink)' : 'var(--border)'}`,
            borderRadius: '0.375rem',
            padding: '0.3rem 0.5rem',
            color: deleteConfirm ? 'var(--pink)' : 'var(--muted)',
            cursor: 'pointer', fontSize: '0.7rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s',
            ...(deleteConfirm ? { fontWeight: 600 } : {}),
          }}
        >
          <Trash2 size={12} />
          {deleteConfirm ? 'Confirm?' : 'Delete'}
        </button>
      </div>

      {/* Messages area + Activity Sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Messages column */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {chatMessages.length === 0 && !streaming && !pendingUserMsg && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '2rem' }}>
            No chat messages in this session
          </div>
        )}
        {chatMessages.map((msg: Message, i: number) => {
          const isSystem = isSystemMessage(msg)
          const isUser = msg.role === 'user' && !isSystem
          const isLastAssistant = !isSystem && !isUser && i === chatMessages.length - 1
          // Show "respuesta interrumpida" indicator when the backend marked this as truncated
          const isTruncated = isLastAssistant && !streaming && msg.truncated === true
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isSystem ? 'center' : isUser ? 'flex-end' : 'flex-start',
              marginBottom: isSystem ? '0.5rem' : '0.75rem',
              maxWidth: isSystem ? '90%' : '75%',
              marginLeft: isSystem ? 'auto' : isUser ? 'auto' : 0,
              marginRight: isSystem ? 'auto' : 0,
            }}>
              <div style={{
                fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.2rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                {isSystem ? <AlertTriangle size={10} /> : isUser ? <User size={10} /> : <Bot size={10} />}
                {isSystem ? 'System' : isUser ? 'You' : (msg.model || 'Assistant')}
              </div>
              <div
                className={isSystem || !isUser ? 'response-markdown' : undefined}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: isSystem ? '0.5rem' : isUser ? '0.75rem 0.75rem 0.2rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.2rem',
                  background: isSystem ? 'rgba(255,176,0,0.08)' : isUser ? 'var(--msg-user-bg, rgba(5,217,232,0.08))' : 'var(--msg-assistant-bg, rgba(0,255,65,0.06))',
                  border: `1px solid ${isSystem ? 'rgba(255,176,0,0.25)' : isUser ? 'var(--msg-user-border, rgba(5,217,232,0.2))' : 'var(--msg-assistant-border, rgba(0,255,65,0.15))'}`,
                  color: isSystem ? 'var(--muted)' : isUser ? 'var(--msg-user-text, var(--txt))' : 'var(--msg-assistant-text, #c0f0c0)',
                  fontSize: isSystem ? '0.78rem' : '0.85rem', lineHeight: 1.5,
                  fontStyle: isSystem ? 'italic' : 'normal',
                  wordBreak: 'break-word', overflowWrap: 'break-word',
                }}
                {...(isUser ? {} : { dangerouslySetInnerHTML: { __html: renderMarkdown(
                  isSystem ? (msg.content || '').replace(/^\[System:\s*/i, '').trim() : (msg.content || '(empty)')
                ) } })}
              >
                {isUser ? (msg.content || '(empty)') : null}
              </div>
              {isTruncated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <span className="animate-pulse" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>▌</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontStyle: 'italic' }}>respuesta interrumpida</span>
                </div>
              )}
            </div>
          )
        })}
        {/* Pending user message (optimistic) */}
        {pendingUserMsg && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            marginBottom: '0.75rem', maxWidth: '75%', marginLeft: 'auto',
          }}>
            <div style={{
              fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.2rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <User size={10} />
              You
            </div>
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem 0.75rem 0.2rem 0.75rem',
              background: 'var(--msg-user-bg, rgba(5,217,232,0.08))',
              border: '1px solid var(--msg-user-border, rgba(5,217,232,0.2))',
              color: 'var(--msg-user-text, var(--txt))',
              fontSize: '0.85rem', lineHeight: 1.5,
              wordBreak: 'break-word', overflowWrap: 'break-word',
            }}>
              {pendingUserMsg}
            </div>
          </div>
        )}
        {/* Streaming bubble — thinking indicator (no tokens yet) */}
        {streaming && !streamText && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            marginBottom: '0.75rem', maxWidth: '75%',
          }}>
            <div style={{
              fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.2rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <Bot size={10} />
              Assistant
            </div>
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem 0.75rem 0.75rem 0.2rem',
              background: 'var(--msg-assistant-bg, rgba(0,255,65,0.06))',
              border: '1px solid var(--msg-assistant-border, rgba(0,255,65,0.15))',
              color: 'var(--msg-assistant-text, #c0f0c0)',
              fontSize: '0.85rem', lineHeight: 1.5,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span className="animate-blink" style={{ color: 'var(--muted)' }}>Thinking...</span>
            </div>
          </div>
        )}
        {/* Streaming bubble — with content */}
        {streaming && streamText && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            marginBottom: '0.75rem', maxWidth: '75%',
          }}>
            <div style={{
              fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.2rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <Bot size={10} />
              Assistant
            </div>
            <div
              className="response-markdown"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem 0.75rem 0.75rem 0.2rem',
                background: 'var(--msg-assistant-bg, rgba(0,255,65,0.06))',
                border: '1px solid var(--msg-assistant-border, rgba(0,255,65,0.15))',
                color: 'var(--msg-assistant-text, #c0f0c0)',
                fontSize: '0.85rem', lineHeight: 1.5,
                wordBreak: 'break-word', overflowWrap: 'break-word',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }}
            />
            <span className="animate-blink" style={{ marginLeft: '0.5rem', color: 'var(--primary)', fontSize: '0.8rem' }}>▌</span>
          </div>
        )}
        {error && (
          <div style={{ padding: '0.5rem', color: 'var(--pink)', fontSize: '0.8rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Activity Sidebar */}
      {showActivity && (
        <div style={{
          width: '320px', minWidth: '280px', maxWidth: '400px',
          borderLeft: '1px solid var(--border)', background: 'var(--bg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={13} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--txt)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}>
                ACTIVITY
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                {activityMessages.length} events
              </span>
            </div>
            <button
              onClick={() => setShowActivity(false)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center',
              }}
              title="Close sidebar"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
          <ActivitySidebar
            messages={activityMessages}
            streaming={streaming}
            streamText={streamText}
          />
        </div>
      )}
    </div>
      <div style={{
        padding: '0.75rem', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={streaming}
          rows={1}
          style={{
            flex: 1, resize: 'none', background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '0.5rem', padding: '0.5rem 0.75rem', color: 'var(--txt)',
            fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: 1.4,
            outline: 'none', minHeight: '2.2rem', maxHeight: '6rem',
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 96) + 'px'
          }}
        />
        {streaming ? (
          <button
            onClick={handleStop}
            style={{
              background: 'rgba(255,0,65,0.1)', border: '1px solid var(--pink)',
              borderRadius: '0.5rem', padding: '0.45rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--pink)', transition: 'all 0.15s',
            }}
          >
            <StopCircle size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? 'var(--primary)' : 'var(--bg2)',
              border: `1px solid ${input.trim() ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '0.5rem', padding: '0.45rem', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: input.trim() ? 'var(--bg)' : 'var(--muted)', transition: 'all 0.15s',
            }}
          >
            <Send size={18} />
          </button>
        )}
      </div>
      {/* Toast notification */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem',
            padding: '0.6rem 1rem',
            background: toast.ok ? 'var(--primary)' : 'var(--pink)',
            color: toast.ok ? 'var(--bg)' : 'white',
            borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 500,
            zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            cursor: 'pointer', transition: 'opacity 0.3s',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Conversations() {
  const { channelId, sessionId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => sessionsApi.create(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      // New sessions from web UI are api_server platform
      navigate(`/conversations/api_server/${data.id}`)
    },
  })

  // Group sessions into channels (exclude cron and empty sessions)
  const channels = useMemo(() => {
    if (!sessions) return []
    // Filter out cron sessions and empty sessions (no real messages, just metadata)
    const nonCron = sessions.filter(s => {
      const id = s.id || ''
      const platform = (s.platform || '').toLowerCase()
      if (id.startsWith('cron_') || platform === 'cron') return false
      // Hide sessions with only a metadata system message (1 message, title is "Session ...")
      // Exception: recently created api_server sessions (user just clicked "New")
      const mc = s.message_count || 0
      const title = s.title || ''
      if (mc <= 1 && title.startsWith('Session ')) {
        const createdMs = s.created ? Date.now() - new Date(s.created).getTime() : Infinity
        const isRecentApiServer = platform === 'api_server' && createdMs < 3600_000 // < 1h ago
        if (!isRecentApiServer) return false
      }
      return true
    })

    const channelMap = new Map<string, Channel>()

    for (const s of nonCron) {
      const platform = (s.platform || 'cli').toLowerCase()
      // Group by platform — each platform is a "channel"
      // For Telegram/Discord: all sessions from same platform = same channel
      const channelId = platform

      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, {
          id: channelId,
          name: getPlatformStyle(platform).label,
          platform,
          sessions: [],
          lastUpdated: s.updated,
          totalMessages: 0,
        })
      }
      const ch = channelMap.get(channelId)!
      ch.sessions.push(s)
      ch.totalMessages += s.message_count || 0
      if (s.updated > ch.lastUpdated) ch.lastUpdated = s.updated
    }

    return Array.from(channelMap.values()).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
  }, [sessions])

  // Get conversations for selected channel
  const conversations = useMemo(() => {
    if (!channelId) return []
    const channel = channels.find(c => c.id === channelId)
    if (!channel) return []

    return channel.sessions
      .map(s => ({
        id: s.id,
        sessionId: s.id,
        title: extractChannelName(s),
        lastMessage: s.title?.slice(0, 40) || 'No preview',
        lastUpdated: s.updated,
        messageCount: s.message_count || 0,
        platform: s.platform || 'cli',
      }))
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
  }, [channelId, channels])

  const selectedChannel = channels.find(c => c.id === channelId) || null
  const selectedSession = sessionId ? conversations.find(c => c.sessionId === sessionId) || null : null

  const handleSelectChannel = (id: string) => {
    navigate(`/conversations/${id}`)
  }

  const handleSelectSession = (id: string) => {
    navigate(`/conversations/${channelId}/${id}`)
  }

  const handleDelete = async () => {
    // The ChatView handles confirmation locally — this is called after deletion succeeds
    qc.invalidateQueries({ queryKey: ['sessions'] })
    qc.invalidateQueries({ queryKey: ['session-messages'] })
    navigate(`/conversations/${channelId}`)
  }

  const handleMessageSent = () => {
    qc.invalidateQueries({ queryKey: ['sessions'] })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Channel list (left) */}
      <div style={{
        width: '220px', minWidth: '220px', borderRight: '1px solid var(--border)',
        background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 4, height: '1.5rem', background: 'var(--primary)', borderRadius: 2, boxShadow: '0 0 8px rgba(0,255,65,0.4)' }} />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                CHATS
              </h1>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              style={{
                background: 'var(--primary)', border: 'none', borderRadius: '0.375rem',
                padding: '0.35rem 0.6rem', cursor: createMutation.isPending ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 600,
                boxShadow: '0 0 8px rgba(0,255,65,0.3)', transition: 'all 0.15s',
              }}
              title="New Chat"
            >
              {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
              New
            </button>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {channels.reduce((acc, c) => acc + c.sessions.length, 0)} conversations
          </div>
        </div>
        <ChannelList
          channels={channels}
          selectedChannelId={channelId || null}
          onSelect={handleSelectChannel}
        />
      </div>

      {/* Conversation list (center) */}
      <div style={{
        width: channelId ? '260px' : '0px', minWidth: channelId ? '260px' : '0px',
        borderRight: '1px solid var(--border)', background: 'var(--bg2)',
        transition: 'width 0.2s, min-width 0.2s', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {channelId && (
          <ConversationList
            conversations={conversations}
            selectedSessionId={sessionId || null}
            onSelect={handleSelectSession}
            channelName={selectedChannel?.name || ''}
          />
        )}
      </div>

      {/* Chat view (right) */}
      <div style={{ flex: 1, background: 'var(--bg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ChatView session={selectedSession} onDelete={handleDelete} onMessageSent={handleMessageSent} />
      </div>
    </div>
  )
}