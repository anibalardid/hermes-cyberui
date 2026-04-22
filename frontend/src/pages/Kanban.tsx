import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, profilesApi } from '../lib/api'
import type { Task, Profile } from '../lib/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Plus, X, GripVertical, Clock, User,
  Archive, Edit3,
  Trash2, RotateCcw, Search, SlidersHorizontal, FileText, Copy, Check, AlertTriangle,
  Maximize2, Minimize2, Activity,
  Inbox, ListTodo, Loader2, CheckCircle2, XCircle,
  CircleDot, Flame, AlertOctagon, ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'backlog' | 'todo' | 'in_progress' | 'done' | 'failed'
type Priority = 'low' | 'medium' | 'high' | 'critical'

const COLUMNS: { id: Status; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
  { id: 'failed', label: 'Failed' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#05d9e8',
  medium: '#00ff41',
  high: '#ffb800',
  critical: '#ff2a6d',
}

const PRIORITY_ICONS: Record<Priority, any> = {
  low: CircleDot,
  medium: ChevronRight,
  high: Flame,
  critical: AlertOctagon,
}

const STATUS_COLORS: Record<string, string> = {
  backlog: '#666',
  todo: '#05d9e8',
  in_progress: '#ffb800',
  done: '#00ff41',
  failed: '#ff2a6d',
  archived: '#444',
}

const STATUS_ICONS: Record<string, any> = {
  backlog: Inbox,
  todo: ListTodo,
  in_progress: Loader2,
  done: CheckCircle2,
  failed: XCircle,
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDueDateInfo(dueDate: string | null) {
  if (!dueDate) return { label: null, color: 'var(--muted)', overdue: false, today: false }
  const now = new Date()
  const due = new Date(dueDate + 'T00:00:00')
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: 'Overdue', color: 'var(--pink)', overdue: true, today: false }
  if (diff === 0) return { label: 'Today', color: '#ffb800', overdue: false, today: true }
  if (diff === 1) return { label: 'Tomorrow', color: 'var(--accent)', overdue: false, today: false }
  if (diff <= 7) return { label: `${diff}d`, color: 'var(--accent)', overdue: false, today: false }
  return {
    label: new Date(dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
    color: 'var(--muted)',
    overdue: false,
    today: false,
  }
}

// ── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onEdit,
  onExecute,
  onArchive,
  onDragStart,
  isExecuting,
  onHistory,
}: {
  task: Task
  onEdit: (t: Task) => void
  onExecute: (t: Task) => void
  onArchive: (t: Task) => void
  onDragStart: (e: React.DragEvent, t: Task) => void
  isExecuting: boolean
  onHistory: (t: Task) => void
}) {
  const [hover, setHover] = useState(false)
  const due = getDueDateInfo(task.due_date)

  // Show running state if this card is executing (local click) OR backend says in_progress
  const isRunning = isExecuting || task.status === 'in_progress'
  const isFailed = task.status === 'failed'

  // Pick status icon
  const StatusIcon = STATUS_ICONS[task.status] || Inbox
  const PrioIcon = PRIORITY_ICONS[task.priority as Priority] || CircleDot

  return (
    <div
      draggable={!isRunning}
      onDragStart={(e) => !isRunning && onDragStart(e, task)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isRunning ? 'rgba(0,255,65,0.08)' : isFailed ? 'rgba(255,42,109,0.06)' : 'var(--surf)',
        border: `1px solid ${isRunning ? 'var(--primary)' : isFailed ? 'var(--pink)' : 'var(--border)'}`,
        borderRadius: '0.5rem',
        marginBottom: '0.5rem',
        cursor: isRunning ? 'default' : 'grab',
        overflow: 'hidden',
        transition: 'all 0.15s',
        boxShadow: hover && !isRunning ? '0 0 0 1px var(--primary)' : isRunning ? '0 0 8px rgba(0,255,65,0.2)' : 'none',
        position: 'relative',
        opacity: isRunning ? 0.85 : 1,
      }}
    >
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '4px',
        background: STATUS_COLORS[task.status] || 'var(--muted)',
      }} />

      <div style={{ padding: '0.6rem 0.6rem 0.6rem 0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          {!isRunning && <GripVertical size={12} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: '2px' }} />}
          {isRunning && (
            <div style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }} title="Hermes cron is executing this task right now">
              <StatusIcon size={14} style={{ color: STATUS_COLORS[task.status] || '#ffb800', animation: 'spin 1.2s linear infinite' }} />
            </div>
          )}
          {!isRunning && (
            <StatusIcon size={13} style={{ color: STATUS_COLORS[task.status] || '#666', flexShrink: 0, marginTop: '1px' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isRunning ? 'var(--primary)' : 'var(--txt)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}>
              {task.title}
            </div>
          </div>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem', paddingLeft: '1.2rem' }}>
            {task.tags.map(tag => (
              <span key={tag} style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '0.25rem',
                background: 'rgba(5,217,232,0.1)',
                color: 'var(--accent)',
                border: '1px solid rgba(5,217,232,0.2)',
              }}>#{tag}</span>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.5rem',
          paddingLeft: '1.2rem',
          flexWrap: 'wrap',
        }}>
          {isFailed && (
            <span className="task-card-failed-badge">
              <X size={8} /> Failed
            </span>
          )}
          {due.label && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.2rem',
              fontSize: '0.65rem', color: due.color,
            }}>
              <Clock size={9} />
              {due.label}
            </div>
          )}
          {task.profile && task.profile !== 'default' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.2rem',
              fontSize: '0.65rem', color: 'var(--muted)',
              background: 'rgba(255,255,255,0.04)',
              padding: '0.1rem 0.3rem',
              borderRadius: '0.25rem',
            }}>
              <User size={9} />
              {task.profile}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.6rem',
            color: PRIORITY_COLORS[task.priority as Priority] || '#666',
            marginLeft: 'auto',
          }}>
            <PrioIcon size={9} />
            {PRIORITY_LABELS[task.priority as Priority] || task.priority}
          </div>
        </div>

        {hover && (
          <div style={{
            display: 'flex', gap: '0.3rem', marginTop: '0.4rem',
            paddingLeft: '1.2rem',
          }}>
            {!isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); onExecute(task) }}
                style={actionBtnStyle(isFailed ? 'var(--warning, #ffb000)' : 'var(--primary)')}
                title={isFailed ? 'Retry' : 'Run'}
              >
                <RotateCcw size={10} /> {isFailed ? 'Retry' : 'Run'}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onHistory(task) }}
              style={actionBtnStyle('#05d9e8')}
              title="Details"
            >
              <Activity size={10} /> Details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task) }}
              style={actionBtnStyle('var(--accent)')}
              title="Edit"
            >
              <Edit3 size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(task) }}
              style={actionBtnStyle('var(--pink)')}
              title="Archive"
            >
              <Archive size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '0.2rem',
    fontSize: '0.65rem', padding: '0.15rem 0.35rem',
    borderRadius: '0.25rem', border: '1px solid',
    borderColor: color, background: 'transparent',
    color, cursor: 'pointer', transition: 'all 0.1s',
  }
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  status,
  label,
  tasks,
  onEdit,
  onExecute,
  onArchive,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  executingTaskIds,
  onHistory,
}: {
  status: Status
  label: string
  tasks: Task[]
  onEdit: (t: Task) => void
  onExecute: (t: Task) => void
  onArchive: (t: Task) => void
  onDragStart: (e: React.DragEvent, t: Task) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, status: Status) => void
  isDragOver: boolean
  executingTaskIds: Set<string>
  onHistory: (t: Task) => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      style={{
        flex: 1,
        minWidth: '220px',
        maxWidth: '320px',
        background: isDragOver ? 'rgba(0,255,65,0.04)' : 'transparent',
        border: isDragOver ? '1px dashed var(--primary)' : '1px solid transparent',
        borderRadius: '0.5rem',
        padding: '0.5rem',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.6rem', padding: '0 0.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--txt)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
          <span style={{
            fontSize: '0.65rem', padding: '0.05rem 0.35rem',
            borderRadius: '1rem', background: 'rgba(255,255,255,0.06)',
            color: 'var(--muted)',
          }}>{tasks.length}</span>
          {status === 'in_progress' && executingTaskIds.size > 0 && (
            <span title={`${executingTaskIds.size} executing`} style={{
              display: 'flex', alignItems: 'center', gap: '0.15rem',
              fontSize: '0.6rem', color: 'var(--primary)',
              fontWeight: 600, fontFamily: "'JetBrains Mono',monospace",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" style={{ animation: 'spin 1.2s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="var(--primary)" strokeWidth="4" fill="none" strokeDasharray="30 10" strokeLinecap="round"/>
              </svg>
              {executingTaskIds.size}
            </span>
          )}
        </div>
      </div>

      <div>
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={onEdit}
            onExecute={onExecute}
            onArchive={onArchive}
            onDragStart={onDragStart}
            isExecuting={executingTaskIds.has(t.id)}
            onHistory={onHistory}
          />
        ))}
        {tasks.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '1.5rem 0.5rem',
            color: 'var(--muted)', fontSize: '0.7rem',
            fontStyle: 'italic',
          }}>
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}

// ── TaskModal ────────────────────────────────────────────────────────────────


function TaskModal({
  task,
  profiles,
  onClose,
  onSave,
  isNew,
}: {
  task: Partial<Task>
  profiles: Profile[]
  onClose: () => void
  onSave: (t: Partial<Task>) => void
  isNew: boolean
}) {
  const [title, setTitle] = useState(task.title || '')
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState<Priority>((task.priority as Priority) || 'medium')
  const [tags, setTags] = useState(task.tags?.join(', ') || '')
  const [profile, setProfile] = useState(task.profile || 'default')
  const [dueDate, setDueDate] = useState(task.due_date || '')

  const isValid = title.trim().length > 0

  const handleSave = () => {
    if (!isValid) return
    onSave({
      ...task,
      title: title.trim(),
      description,
      priority,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      profile,
      due_date: dueDate || null,
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--txt)' }}>
              {isNew ? 'New Task' : 'Edit Task'}
            </span>
          {!isNew && task?.id && (
              <span style={{
                fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.25)', padding: '0.1rem 0.3rem',
                borderRadius: '0.25rem', border: '1px solid var(--border)',
              }}>
                {task.id.slice(0, 8)}
              </span>
            )}
          </span>
          <button onClick={onClose} style={closeBtnStyle()}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              style={inputStyle()}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Markdown supported..."
              rows={4}
              style={{ ...inputStyle(), resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                style={selectStyle(PRIORITY_COLORS[priority])}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Profile</label>
              <select
                value={profile}
                onChange={e => setProfile(e.target.value)}
                style={inputStyle()}
              >
                {profiles.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Tags (comma separated)</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="api, bug, ux"
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={inputStyle()}
              />
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={cancelBtnStyle()}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            style={{
              ...saveBtnStyle(),
              opacity: isValid ? 1 : 0.4,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            {isNew ? 'Create Task' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TaskDetailsModal (unified History+Response with tabs + maximize) ──────

type DetailsTab = 'response' | 'history'

function TaskDetailsModal({ task, onClose, initialTab }: { task: Task; onClose: () => void; initialTab?: DetailsTab }) {
  const qc = useQueryClient()
  const isRunning = task.status === 'in_progress'
  const isDone = task.status === 'done'
  const isFailed = task.status === 'failed'
  const [liveLog, setLiveLog] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)

  // Default tab: response if done, history otherwise
  const [activeTab, setActiveTab] = useState<DetailsTab>(initialTab || (isDone ? 'response' : 'history'))

  // Poll task data for updates when running
  const { data: liveTask } = useQuery({
    queryKey: ['task-live', task.id],
    queryFn: () => tasksApi.get(task.id),
    refetchInterval: isRunning ? 3000 : false,
    enabled: isRunning,
  })

  // Poll the execution log when running
  const { data: logData } = useQuery({
    queryKey: ['task-log', task.id],
    queryFn: () => tasksApi.executeLog(task.id),
    refetchInterval: isRunning ? 3000 : false,
    enabled: isRunning,
  })

  // When task finishes, invalidate queries and stop polling
  useEffect(() => {
    if (liveTask && liveTask.status !== 'in_progress' && isRunning) {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      // Auto-switch to response tab when done
      if (liveTask.status === 'done') setActiveTab('response')
    }
  }, [liveTask, isRunning, qc])

  // Update live log
  useEffect(() => {
    if (logData?.log) setLiveLog(logData.log)
  }, [logData])

  // Use live task data if available, otherwise fall back to prop
  const displayTask = liveTask || task
  const history = displayTask.history || []
  const responses = [...history].reverse().filter((h: any) => h.details?.output)
  const hasResponse = responses.length > 0

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(idx)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  const renderMarkdown = (text: string) => {
    try {
      const rawHtml = marked.parse(text, { async: false, breaks: true, gfm: true }) as string
      return DOMPurify.sanitize(rawHtml)
    } catch {
      return DOMPurify.sanitize(text)
    }
  }

  const modalMaxWidth = maximized ? '100vw' : '780px'
  const modalMaxHeight = maximized ? '100vh' : '85vh'
  const modalRadius = maximized ? '0' : '0.75rem'
  const modalPadding = maximized ? '0' : '1rem'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: maximized ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: maximized ? 'stretch' : 'center', justifyContent: maximized ? 'stretch' : 'center',
        padding: modalPadding,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surf)',
          border: maximized ? 'none' : '1px solid var(--border)',
          borderRadius: modalRadius,
          width: '100%',
          maxWidth: modalMaxWidth,
          maxHeight: modalMaxHeight,
          height: maximized ? '100%' : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {activeTab === 'response' ? <FileText size={14} style={{ color: 'var(--primary)' }} /> : <Activity size={14} style={{ color: 'var(--accent)' }} />}
                {activeTab === 'response' ? 'Response' : 'History'}
                {isRunning && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div className="animate-spin" style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid var(--primary)', borderTopColor: 'transparent',
                    }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600 }}>RUNNING</span>
                  </span>
                )}
                {isDone && !isRunning && <CheckCircle2 size={13} style={{ color: '#00ff41' }} />}
                {isFailed && !isRunning && <XCircle size={13} style={{ color: '#ff2a6d' }} />}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{task.title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => setMaximized(!maximized)}
              title={maximized ? 'Restore' : 'Maximize'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: '0.25rem',
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--txt)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '0.25rem',
              display: 'flex', alignItems: 'center',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveTab('response')}
            style={{
              flex: 1, padding: '0.5rem 1rem',
              fontSize: '0.75rem', fontWeight: 600,
              background: activeTab === 'response' ? 'rgba(0,255,65,0.08)' : 'transparent',
              color: activeTab === 'response' ? 'var(--primary)' : 'var(--muted)',
              border: 'none',
              borderBottom: activeTab === 'response' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.15s',
            }}
          >
            <FileText size={12} />
            Response {hasResponse ? `(${responses.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1, padding: '0.5rem 1rem',
              fontSize: '0.75rem', fontWeight: 600,
              background: activeTab === 'history' ? 'rgba(5,217,232,0.08)' : 'transparent',
              color: activeTab === 'history' ? 'var(--accent)' : 'var(--muted)',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.15s',
            }}
          >
            <Activity size={12} />
            History ({history.length})
          </button>
        </div>

        {/* ── Live log when running ───────────────────────────────────── */}
        {isRunning && liveLog && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <div className="animate-spin" style={{
                width: 10, height: 10, borderRadius: '50%',
                border: '2px solid var(--accent)', borderTopColor: 'transparent',
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em' }}>LIVE OUTPUT</span>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(5,217,232,0.2)',
              borderRadius: '0.4rem',
              padding: '0.6rem',
              fontSize: '0.7rem',
              color: '#b0e0b0',
              maxHeight: '180px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              lineHeight: 1.5,
            }}>
              {liveLog}
            </div>
          </div>
        )}

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>

          {/* RESPONSE TAB */}
          {activeTab === 'response' && (
            responses.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                {isRunning ? 'Task is running... response will appear here when done' : 'No response data available'}
              </div>
            ) : (
              responses.map((h: any, i: number) => (
                <div key={i} style={{
                  marginBottom: responses.length > 1 ? '1.5rem' : 0,
                  paddingBottom: responses.length > 1 && i < responses.length - 1 ? '1.5rem' : 0,
                  borderBottom: responses.length > 1 && i < responses.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        color: h.action === 'completed' ? 'var(--primary)' : 'var(--accent)',
                        textTransform: 'uppercase',
                        background: h.action === 'completed' ? 'rgba(0,255,65,0.15)' : 'rgba(5,217,232,0.15)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.2rem',
                        border: `1px solid ${h.action === 'completed' ? 'rgba(0,255,65,0.4)' : 'rgba(5,217,232,0.4)'}`,
                      }}>
                        {h.action === 'completed' ? '✓ ' : ''}{h.action}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(224,224,224,0.8)' }}>
                        {new Date(h.timestamp).toLocaleString('en-US', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(String(h.details.output), i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.7rem', padding: '0.3rem 0.6rem',
                        background: copiedIndex === i ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.06)',
                        color: copiedIndex === i ? 'var(--primary)' : 'var(--txt)',
                        border: `1px solid ${copiedIndex === i ? 'rgba(0,255,65,0.3)' : 'var(--border)'}`,
                        borderRadius: '0.3rem', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {copiedIndex === i ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                    </button>
                  </div>

                  <div
                    className="response-markdown"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(0,255,65,0.2)',
                      borderRadius: '0.5rem',
                      padding: '1rem 1.25rem',
                      color: '#e8e8e8',
                      lineHeight: 1.6,
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(String(h.details.output)) }}
                  />

                  {h.details?.error && (
                    <div style={{
                      marginTop: '0.5rem',
                      background: 'rgba(255,42,109,0.1)',
                      border: '1px solid rgba(255,42,109,0.3)',
                      borderRadius: '0.3rem',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      color: '#ff6b6b',
                      fontFamily: 'monospace',
                    }}>
                      ERROR: {h.details.error}
                    </div>
                  )}
                </div>
              ))
            )
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            history.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                No history yet
              </div>
            ) : (
              [...history].reverse().map((h: any, i: number) => {
                const isProgress = h.action === 'progress'
                const isCompleted = h.action === 'completed'
                return (
                <div key={i} style={{
                  marginBottom: '1rem',
                  paddingBottom: '1rem',
                  borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: isProgress ? 0.65 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    {isProgress && (
                      <div className="animate-spin" style={{
                        width: 10, height: 10, borderRadius: '50%',
                        border: '2px solid var(--accent)', borderTopColor: 'transparent', flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      color: isCompleted ? 'var(--primary)'
                        : h.action === 'executed' ? 'var(--accent)'
                        : h.action === 'dispatched' ? 'var(--warning, #ffb000)'
                        : h.action === 'created' ? 'var(--txt)'
                        : h.action === 'failed' ? 'var(--pink)'
                        : isProgress ? 'var(--accent)'
                        : 'var(--muted)',
                      textTransform: 'uppercase',
                      background: isCompleted ? 'rgba(0,255,65,0.15)'
                        : h.action === 'executed' ? 'rgba(5,217,232,0.15)'
                        : h.action === 'failed' ? 'rgba(255,42,109,0.15)'
                        : isProgress ? 'rgba(5,217,232,0.08)'
                        : 'rgba(255,255,255,0.08)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.2rem',
                      border: `1px solid ${isCompleted ? 'rgba(0,255,65,0.4)'
                        : h.action === 'executed' ? 'rgba(5,217,232,0.4)'
                        : h.action === 'failed' ? 'rgba(255,42,109,0.4)'
                        : isProgress ? 'rgba(5,217,232,0.25)'
                        : 'rgba(255,255,255,0.15)'}`,
                    }}>
                      {isCompleted ? '✓ ' : ''}{h.action}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(224,224,224,0.8)' }}>
                      {new Date(h.timestamp).toLocaleString('en-US', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {h.from_status && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent)', opacity: 0.85 }}>
                        <span style={{ textTransform: 'capitalize' }}>{h.from_status}</span>
                        {' '}→{' '}
                        <span style={{ textTransform: 'capitalize' }}>{h.to_status}</span>
                      </span>
                    )}
                  </div>

                  {h.note && !isProgress && (
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--accent)',
                      background: 'rgba(5,217,232,0.08)',
                      border: '1px solid rgba(5,217,232,0.2)',
                      padding: '0.35rem 0.55rem',
                      borderRadius: '0.3rem',
                      marginBottom: '0.3rem',
                    }}>
                      "{h.note}"
                    </div>
                  )}

                  {isProgress && h.note && (
                    <div style={{
                      fontSize: '0.7rem', color: 'var(--accent)',
                      background: 'rgba(5,217,232,0.05)',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.2rem',
                      marginBottom: '0.2rem',
                    }}>
                      {h.note}
                    </div>
                  )}

                  {h.details?.output && (
                    <div style={{
                      marginTop: '0.4rem',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(0,255,65,0.15)',
                      borderRadius: '0.4rem',
                      padding: '0.6rem 0.75rem',
                      fontSize: '0.75rem',
                      color: '#e0e0e0',
                      maxHeight: '150px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      lineHeight: 1.5,
                    }}>
                      <div style={{ color: 'var(--primary)', fontSize: '0.65rem', marginBottom: '0.3rem', fontWeight: 600, letterSpacing: '0.05em' }}>RESULTADO</div>
                      {h.details.output}
                    </div>
                  )}

                  {h.details?.error && (
                    <div style={{
                      marginTop: '0.3rem',
                      background: 'rgba(255,42,109,0.1)',
                      border: '1px solid rgba(255,42,109,0.3)',
                      borderRadius: '0.3rem',
                      padding: '0.35rem 0.55rem',
                      fontSize: '0.7rem',
                      color: '#ff6b6b',
                      fontFamily: 'monospace',
                    }}>
                      ERROR: {h.details.error}
                    </div>
                  )}

                  {h.details && !h.details.output && !isProgress && Object.entries(h.details)
                    .filter(([k]) => k !== 'cron_job_id')
                    .map(([k, v]) => (
                      <div key={k} style={{ fontSize: '0.65rem', color: 'rgba(224,224,224,0.75)', marginTop: '0.2rem' }}>
                        <span style={{ color: 'var(--accent)', opacity: 0.7 }}>{k}:</span>{' '}
                        <span>{String(v)}</span>
                      </div>
                    ))
                  }
                </div>
                )
              })
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '380px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--txt)', marginBottom: '0.5rem' }}>
            {title}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            {message}
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
          padding: '1rem 1.25rem',
        }}>
          <button onClick={onCancel} style={cancelBtnStyle()}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.4rem 0.9rem', fontSize: '0.8rem',
              background: danger ? 'var(--pink)' : 'var(--primary)',
              color: danger ? 'white' : 'var(--bg)',
              border: 'none', borderRadius: '0.35rem', cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ArchivedView ──────────────────────────────────────────────────────────────

function ArchivedView({
  tasks,
  onRestore,
  onDelete,
  onPurge,
  onClose,
}: {
  tasks: Task[]
  onRestore: (t: Task) => void
  onDelete: (t: Task) => void
  onPurge: () => void
  onClose: () => void
}) {
  const [confirmPurge, setConfirmPurge] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Archive size={14} style={{ color: 'var(--muted)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--txt)' }}>
              Archived Tasks ({tasks.length})
            </span>
          </div>
          <button onClick={onClose} style={closeBtnStyle()}>
            <X size={14} />
          </button>
        </div>

        {!confirmPurge && tasks.length > 0 && (
          <div style={{ padding: '0.5rem 1.25rem 0', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirmPurge(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.7rem', padding: '0.3rem 0.6rem',
                background: 'rgba(255,42,109,0.08)',
                color: 'var(--pink)',
                border: '1px solid rgba(255,42,109,0.25)',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
              title="Permanently delete ALL archived tasks"
            >
              <Trash2 size={10} />
              Purge All
            </button>
          </div>
        )}

        {confirmPurge && (
          <div style={{ padding: '0.5rem 1.25rem 0', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--warning)', marginRight: '0.3rem' }}>
              Delete {tasks.length} archived tasks forever?
            </span>
            <button
              onClick={() => { onPurge(); setConfirmPurge(false); }}
              style={{
                fontSize: '0.7rem', padding: '0.25rem 0.5rem',
                background: 'var(--pink)',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              Yes, purge it
            </button>
            <button
              onClick={() => setConfirmPurge(false)}
              style={{
                fontSize: '0.7rem', padding: '0.25rem 0.5rem',
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {tasks.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2rem',
              color: 'var(--muted)', fontSize: '0.8rem',
              fontStyle: 'italic',
            }}>
              No archived tasks
            </div>
          ) : (
            tasks.map(t => {
              const due = getDueDateInfo(t.due_date)
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem',
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  marginBottom: '0.4rem',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--txt)' }}>
                      {t.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {due.label && (
                        <span style={{ fontSize: '0.65rem', color: due.color }}>
                          <Clock size={9} style={{ marginRight: '0.2rem', verticalAlign: 'middle' }} />
                          {due.label}
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.65rem',
                        color: PRIORITY_COLORS[t.priority as Priority] || 'var(--muted)',
                      }}>
                        {PRIORITY_LABELS[t.priority as Priority]}
                      </span>
                      {t.profile && t.profile !== 'default' && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                          <User size={9} style={{ marginRight: '0.2rem', verticalAlign: 'middle' }} />
                          {t.profile}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button
                      onClick={() => onRestore(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.7rem', padding: '0.3rem 0.5rem',
                        background: 'rgba(0,255,65,0.1)',
                        color: 'var(--primary)',
                        border: '1px solid rgba(0,255,65,0.3)',
                        borderRadius: '0.25rem', cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={10} />
                      Restore
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.7rem', padding: '0.3rem 0.5rem',
                        background: 'rgba(255,42,109,0.1)',
                        color: 'var(--pink)',
                        border: '1px solid rgba(255,42,109,0.3)',
                        borderRadius: '0.25rem', cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  profiles,
}: {
  filters: { profile: string; tag: string; priority: string; due: string }
  onChange: (f: typeof filters) => void
  profiles: Profile[]
}) {
  const hasFilters = filters.profile || filters.tag || filters.priority || filters.due

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--border)',
      fontSize: '0.75rem',
      alignItems: 'center',
    }}>
      <SlidersHorizontal size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />

      <select
        value={filters.profile}
        onChange={e => onChange({ ...filters, profile: e.target.value })}
        style={filterSelectStyle(filters.profile ? 'var(--primary)' : undefined)}
      >
        <option value="">All Profiles</option>
        {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>

      <div style={{ position: 'relative', flex: '1', minWidth: '120px', maxWidth: '180px' }}>
        <Search size={11} style={{
          position: 'absolute', left: '0.5rem', top: '50%',
          transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none',
        }} />
        <input
          value={filters.tag}
          onChange={e => onChange({ ...filters, tag: e.target.value })}
          placeholder="Filter by tag..."
          style={{ ...filterInputStyle(), paddingLeft: '1.6rem' }}
        />
      </div>

      <select
        value={filters.priority}
        onChange={e => onChange({ ...filters, priority: e.target.value })}
        style={filterSelectStyle(filters.priority ? PRIORITY_COLORS[filters.priority as Priority] : undefined)}
      >
        <option value="">All Priorities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>

      <select
        value={filters.due}
        onChange={e => onChange({ ...filters, due: e.target.value })}
        style={filterSelectStyle(filters.due ? 'var(--accent)' : undefined)}
      >
        <option value="">All Dates</option>
        <option value="overdue">Overdue</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
      </select>

      {hasFilters && (
        <button
          onClick={() => onChange({ profile: '', tag: '', priority: '', due: '' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.7rem', color: 'var(--pink)',
            background: 'rgba(255,42,109,0.1)', border: '1px solid rgba(255,42,109,0.3)',
            borderRadius: '0.25rem', padding: '0.35rem 0.6rem', cursor: 'pointer',
          }}
        >
          <X size={10} /> Clear
        </button>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle = (): React.CSSProperties => ({
  width: '100%',
  padding: '0.4rem 0.6rem',
  fontSize: '0.8rem',
  background: 'var(--bg)',
  color: 'var(--txt)',
  border: '1px solid var(--border)',
  borderRadius: '0.35rem',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
})

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  color: 'var(--muted)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const selectStyle = (color: string): React.CSSProperties => ({
  ...inputStyle(),
  borderColor: color,
  color,
})

const closeBtnStyle = (): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '1.75rem', height: '1.75rem',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: '0.35rem', color: 'var(--muted)', cursor: 'pointer',
})

const cancelBtnStyle = (): React.CSSProperties => ({
  padding: '0.4rem 0.9rem', fontSize: '0.8rem',
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: '0.35rem', cursor: 'pointer',
})

const saveBtnStyle = (): React.CSSProperties => ({
  padding: '0.4rem 0.9rem', fontSize: '0.8rem',
  background: 'var(--primary)', color: 'var(--bg)',
  border: 'none', borderRadius: '0.35rem',
})

const filterSelectStyle = (color?: string): React.CSSProperties => ({
  padding: '0.35rem 2rem 0.35rem 0.6rem',
  fontSize: '0.75rem',
  background: 'var(--bg)',
  color: color || 'var(--muted)',
  border: `1px solid ${color || 'var(--border)'}`,
  borderRadius: '0.3rem',
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
})

const filterInputStyle = (): React.CSSProperties => ({
  width: '100%',
  padding: '0.35rem 0.6rem',
  fontSize: '0.75rem',
  background: 'var(--bg)',
  color: 'var(--txt)',
  border: '1px solid var(--border)',
  borderRadius: '0.3rem',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
})

// ── Main Component ────────────────────────────────────────────────────────────

export default function Kanban() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)
  const [filters, setFilters] = useState({ profile: '', tag: '', priority: '', due: '' })
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; confirmLabel: string; onConfirm: () => void; danger?: boolean
  } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [executingTaskIds, setExecutingTaskIds] = useState<Set<string>>(new Set())
  const [historyTask, setHistoryTask] = useState<Task | null>(null)

  const hasRunningTasks = executingTaskIds.size > 0

  // ── Gateway status check ──────────────────────────────────────────────────
  const { data: gatewayStatus } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: tasksApi.gatewayStatus,
    refetchInterval: 60000, // check every minute
    staleTime: 30000,
  })

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.list,
    refetchInterval: hasRunningTasks ? 5000 : false,
  })

  const { data: archivedData } = useQuery({
    queryKey: ['tasks-archived'],
    queryFn: tasksApi.listArchived,
  })

  const { data: profilesData } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (task: Partial<Task>) => tasksApi.create(task as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowModal(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => tasksApi.update(id, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setEditingTask(null) },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => tasksApi.move(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const executeMutation = useMutation({
    mutationFn: (id: string) => tasksApi.execute(id),
    onMutate: (id: string) => { setExecutingTaskIds(prev => new Set(prev).add(id)) },
    onSuccess: (_result, _id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      showToast('Task running in background — will move to Done when finished', true)
    },
    onError: (err, id) => {
      setExecutingTaskIds(prev => { const next = new Set(prev); next.delete(id); return next })
      showToast(`Execution failed: ${(err as Error).message}`, false)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => tasksApi.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); showToast('Task archived', true) },
  })

  const archiveAllDoneMutation = useMutation({
    mutationFn: () => tasksApi.archiveAllDone(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); showToast('All done tasks archived', true) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => tasksApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks-archived'] })
      showToast('Task restored to Backlog', true)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-archived'] })
      showToast('Task permanently deleted', true)
    },
  })

  const purgeMutation = useMutation({
    mutationFn: () => tasksApi.purgeAllArchived(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks-archived'] })
      showToast(`${data.deleted_count} archived tasks purged`, true)
    },
    onError: () => showToast('Failed to purge archived tasks', false),
  })

  const tasks: Task[] = tasksData?.tasks ?? []
  const archived: Task[] = archivedData?.archived ?? []
  const profiles: Profile[] = profilesData?.profiles ?? []

  // Clean up executingTaskIds when tasks are no longer in_progress
  // Also detect tasks that are in_progress from server but not in our local set
  useEffect(() => {
    const serverInProgress = new Set(
      tasks.filter(t => t.status === 'in_progress').map(t => t.id)
    )
    // Remove local IDs that are no longer running on server
    const toRemove: string[] = []
    for (const id of executingTaskIds) {
      if (!serverInProgress.has(id)) {
        toRemove.push(id)
      }
    }
    // Add server IDs that are running but not in our local set
    const toAdd: string[] = []
    for (const id of serverInProgress) {
      if (!executingTaskIds.has(id)) {
        toAdd.push(id)
      }
    }
    if (toRemove.length > 0 || toAdd.length > 0) {
      setExecutingTaskIds(prev => {
        const next = new Set(prev)
        for (const id of toRemove) next.delete(id)
        for (const id of toAdd) next.add(id)
        return next
      })
    }
  }, [tasks])

  const filteredTasks = tasks.filter(t => {
    if (filters.profile && t.profile !== filters.profile) return false
    if (filters.priority && t.priority !== filters.priority) return false
    if (filters.tag && !t.tags?.includes(filters.tag)) return false
    if (filters.due) {
      const due = getDueDateInfo(t.due_date)
      if (filters.due === 'overdue' && !due.overdue) return false
      if (filters.due === 'today' && !due.today) return false
      if (filters.due === 'week' && !due.overdue && !due.today) return false
    }
    return true
  })

  const byStatus = (s: Status) => filteredTasks.filter(t => t.status === s)

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }

  const handleDrop = (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) moveMutation.mutate({ id: taskId, status })
    setDragOverCol(null)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const openNew = () => { setEditingTask({}); setShowModal(true) }
  const openEdit = (t: Task) => { setEditingTask(t); setShowModal(true) }

  const handleSave = (data: Partial<Task>) => {
    if (data.id) {
      updateMutation.mutate({ id: data.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleExecute = async (t: Task) => {
    // If task is failed, move it back to backlog first
    if (t.status === 'failed') {
      await moveMutation.mutateAsync({ id: t.id, status: 'backlog' })
    }
    // Add to executing set and trigger mutation
    setExecutingTaskIds(prev => new Set(prev).add(t.id))
    executeMutation.mutate(t.id)
  }

  const askArchive = (t: Task) => {
    setConfirmModal({
      title: 'Archive Task',
      message: `Archive "${t.title}"? It will be moved to the archived list.`,
      confirmLabel: 'Archive',
      onConfirm: () => { archiveMutation.mutate(t.id); setConfirmModal(null) },
      danger: true,
    })
  }

  const handleOpenHistory = (t: Task) => {
    setHistoryTask(t)
  }

  const askArchiveAllDone = () => {
    const count = doneOrFailedCount
    setConfirmModal({
      title: 'Archive Completed',
      message: `Archive ${count} task${count !== 1 ? 's' : ''} in Done/Failed? They will be moved to archived.`,
      confirmLabel: `Archive ${count}`,
      onConfirm: () => { archiveAllDoneMutation.mutate(); setConfirmModal(null) },
      danger: true,
    })
  }

  const handleRestore = (t: Task) => {
    moveMutation.mutate({ id: t.id, status: 'backlog' })
    restoreMutation.mutate(t.id)
  }

  const handleDelete = (t: Task) => {
    setConfirmModal({
      title: 'Delete Permanently',
      message: `Delete "${t.title}" permanently? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => { deleteMutation.mutate(t.id); setConfirmModal(null) },
      danger: true,
    })
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 5000)
  }

  const doneOrFailedCount = byStatus('done').length + byStatus('failed').length

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--muted)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Tasks</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '0.2rem 0 0' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {byStatus('done').length > 0 && ` · ${byStatus('done').length} done`}
            {byStatus('failed').length > 0 && ` · ${byStatus('failed').length} failed`}
            {archived.length > 0 && ` · ${archived.length} archived`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {archived.length > 0 && (
            <button
              onClick={() => setShowArchived(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.75rem', padding: '0.4rem 0.75rem',
                background: 'rgba(255,255,255,0.04)', color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: '0.35rem', cursor: 'pointer',
              }}
            >
              <Archive size={12} />
              Archived ({archived.length})
            </button>
          )}
          {doneOrFailedCount > 0 && (
            <button
              onClick={askArchiveAllDone}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.75rem', padding: '0.4rem 0.75rem',
                background: 'rgba(255,42,109,0.1)', color: 'var(--pink)',
                border: '1px solid rgba(255,42,109,0.3)',
                borderRadius: '0.35rem', cursor: 'pointer',
              }}
            >
              <Archive size={12} />
              Archive {doneOrFailedCount} Done/Failed
            </button>
          )}
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.75rem', padding: '0.4rem 0.75rem',
              background: 'var(--primary)', color: 'var(--bg)',
              border: 'none', borderRadius: '0.35rem', cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} profiles={profiles} />

      {/* ── Gateway Ticker Warning Banner ─────────────────────────────────────── */}
      {gatewayStatus && !gatewayStatus.ticker_alive && (
        <div className="gateway-warning-banner" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'rgba(255,176,0,0.12)',
          borderBottom: '1px solid rgba(255,176,0,0.3)',
          fontSize: '0.75rem',
          color: 'var(--warning, #ffb000)',
        }}>
          <AlertTriangle size={14} />
          <span>
            Gateway cron ticker is not running — task execution will timeout.
            Restart with: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>hermes gateway restart</code>
          </span>
          {gatewayStatus.last_tick_age_secs != null && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.65rem' }}>
              (Last cron activity: {Math.floor(gatewayStatus.last_tick_age_secs / 60)}m ago)
            </span>
          )}
        </div>
      )}

      <div
        onDragLeave={handleDragLeave}
        style={{
          display: 'flex', gap: '0.75rem', padding: '1rem',
          overflowX: 'auto', flex: 1,
        }}
      >
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            tasks={byStatus(col.id)}
            onEdit={openEdit}
            onExecute={handleExecute}
            onArchive={askArchive}
            onDragStart={handleDragStart}
            onDragOver={e => handleDragOver(e, col.id)}
            onDrop={handleDrop}
            isDragOver={dragOverCol === col.id}
            executingTaskIds={executingTaskIds}
            onHistory={handleOpenHistory}
          />
        ))}
      </div>

      {showModal && (
        <TaskModal
          task={editingTask || {}}
          profiles={profiles}
          onClose={() => { setShowModal(false); setEditingTask(null) }}
          onSave={handleSave}
          isNew={!editingTask?.id}
        />
      )}

      {showArchived && (
        <ArchivedView
          tasks={archived}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onPurge={() => purgeMutation.mutate()}
          onClose={() => setShowArchived(false)}
        />
      )}

      {historyTask && (
        <TaskDetailsModal
          task={historyTask}
          onClose={() => setHistoryTask(null)}
          initialTab={historyTask.status === 'done' ? 'response' : 'history'}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.danger}
        />
      )}

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
            cursor: 'pointer',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}