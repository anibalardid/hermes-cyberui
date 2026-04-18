import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, profilesApi } from '../lib/api'
import type { Task, Profile } from '../lib/api'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Plus, X, GripVertical, Clock, User,
  ChevronDown, Archive, Play, Edit3, MessageSquare, ArrowRight,
  Trash2, RotateCcw, Search, SlidersHorizontal, FileText, Copy, Check, AlertTriangle
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
  low: 'var(--accent)',
  medium: 'var(--primary)',
  high: '#ffb800',
  critical: 'var(--pink)',
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'var(--muted)',
  in_progress: 'var(--warning)',
  done: 'var(--primary)',
  failed: 'var(--danger)',
  archived: 'var(--muted)',
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
    label: new Date(dueDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
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
  onResponse,
}: {
  task: Task
  onEdit: (t: Task) => void
  onExecute: (t: Task) => void
  onArchive: (t: Task) => void
  onDragStart: (e: React.DragEvent, t: Task) => void
  isExecuting: boolean
  onHistory: (t: Task) => void
  onResponse: (t: Task) => void
}) {
  const [hover, setHover] = useState(false)
  const due = getDueDateInfo(task.due_date)

  // Show running state if this card is executing
  const isRunning = isExecuting
  const isFailed = task.status === 'failed'

  // Check if task has a response (output) in its history
  const hasResponse = (task.history || []).some((h: any) => h.details?.output)

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
              flexShrink: 0, marginTop: '2px',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 600,
            }}>
              <div style={{
                width: '10px', height: '10px',
                borderRadius: '50%',
                background: 'var(--primary)',
                animation: 'pulse 1s infinite',
              }} />
              Running
            </div>
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
            fontSize: '0.6rem',
            color: PRIORITY_COLORS[task.priority as Priority] || 'var(--muted)',
            marginLeft: 'auto',
          }}>
            {PRIORITY_LABELS[task.priority as Priority] || task.priority}
          </div>
        </div>

        {hover && !isRunning && (
          <div style={{
            display: 'flex', gap: '0.3rem', marginTop: '0.4rem',
            paddingLeft: '1.2rem',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onExecute(task) }}
              style={actionBtnStyle(isFailed ? 'var(--warning, #ffb000)' : 'var(--primary)')}
              title={isFailed ? 'Retry' : 'Run'}
            >
              <Play size={10} /> {isFailed ? 'Retry' : 'Run'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHistory(task) }}
              style={actionBtnStyle('var(--accent)')}
              title="History"
            >
              <MessageSquare size={10} />
            </button>
            {hasResponse && (
              <button
                onClick={(e) => { e.stopPropagation(); onResponse(task) }}
                style={actionBtnStyle('var(--primary)')}
                title="Response"
              >
                <FileText size={10} />
              </button>
            )}
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
  onResponse,
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
  onResponse: (t: Task) => void
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
            onResponse={onResponse}
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
  onAddNote,
  isNew,
}: {
  task: Partial<Task>
  profiles: Profile[]
  onClose: () => void
  onSave: (t: Partial<Task>) => void
  onAddNote: (taskId: string, note: string) => void
  isNew: boolean
}) {
  const [title, setTitle] = useState(task.title || '')
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState<Priority>((task.priority as Priority) || 'medium')
  const [tags, setTags] = useState(task.tags?.join(', ') || '')
  const [profile, setProfile] = useState(task.profile || 'default')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [noteText, setNoteText] = useState('')
  const [showHistory, setShowHistory] = useState(false)

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

  const handleAddNote = () => {
    if (!noteText.trim() || !task.id) return
    onAddNote(task.id, noteText.trim())
    setNoteText('')
  }

  const history = task.history || []

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

          {!isNew && history.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.75rem', color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <MessageSquare size={12} />
                History ({history.length} entries)
                <ChevronDown size={12} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
              </button>

              {showHistory && (
                <div style={{
                  marginTop: '0.5rem',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  maxHeight: '320px',
                  overflow: 'auto',
                }}>
                  {[...history].reverse().map((h: any, i: number) => {
                    const isCompleted = h.action === 'completed'
                    return (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', gap: '0.2rem',
                      marginBottom: '0.6rem',
                      padding: '0.5rem',
                      borderRadius: '0.3rem',
                      background: isCompleted ? 'rgba(0,255,65,0.05)' : 'rgba(0,0,0,0.15)',
                      borderLeft: isCompleted ? '3px solid var(--primary)' : '3px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700,
                          color: isCompleted ? 'var(--primary)' : 'var(--txt)',
                          background: isCompleted ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.08)',
                          padding: '0.1rem 0.35rem', borderRadius: '0.2rem',
                          border: `1px solid ${isCompleted ? 'rgba(0,255,65,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {isCompleted ? '✓ ' : ''}{h.action}
                        </span>
                        {h.from_status && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--accent)', opacity: 0.85 }}>
                            <span style={{ textTransform: 'capitalize' }}>{h.from_status}</span>
                            <ArrowRight size={7} style={{ margin: '0 0.2rem', verticalAlign: 'middle' }} />
                            <span style={{ textTransform: 'capitalize' }}>{h.to_status}</span>
                          </span>
                        )}
                        <span style={{ fontSize: '0.6rem', color: 'rgba(224,224,224,0.7)', marginLeft: 'auto' }}>
                          {new Date(h.timestamp).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {h.note && (
                        <div style={{ color: 'var(--accent)', fontSize: '0.75rem', fontStyle: 'italic' }}>"{h.note}"</div>
                      )}
                      {h.details?.output && (
                        <div style={{
                          marginTop: '0.4rem',
                          background: 'rgba(0,0,0,0.4)',
                          borderRadius: '0.3rem',
                          padding: '0.5rem 0.6rem',
                          fontSize: '0.68rem',
                          color: '#e8e8e8',
                          maxHeight: '200px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          border: '1px solid rgba(0,255,65,0.15)',
                        }}>
                          <div style={{ color: 'var(--primary)', fontSize: '0.6rem', marginBottom: '0.3rem', fontWeight: 600, letterSpacing: '0.05em' }}>RESULTADO</div>
                          {h.details.output}
                        </div>
                      )}
                      {h.details?.error && (
                        <div style={{
                          marginTop: '0.3rem',
                          background: 'rgba(255,42,109,0.1)',
                          border: '1px solid rgba(255,42,109,0.3)',
                          borderRadius: '0.3rem',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.65rem',
                          color: '#ff6b6b',
                          fontFamily: 'monospace',
                        }}>
                          ERROR: {h.details.error}
                        </div>
                      )}
                      {isCompleted && h.details?.cron_job_id && (
                        <div style={{ fontSize: '0.6rem', color: 'rgba(224,224,224,0.7)', marginTop: '0.2rem' }}>
                          Job ID: {h.details.cron_job_id}
                        </div>
                      )}
                    </div>
                  )})}

                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <input
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      style={{ ...inputStyle(), fontSize: '0.7rem', padding: '0.25rem 0.4rem' }}
                      onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                    />
                    <button
                      onClick={handleAddNote}
                      style={{
                        fontSize: '0.65rem', padding: '0.25rem 0.5rem',
                        background: 'var(--primary)', color: 'var(--bg)',
                        border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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

function HistoryModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const history = task.history || []

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.75)',
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
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--txt)' }}>History</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{task.title}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '0.25rem',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
          {history.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
              No history yet
            </div>
          ) : (
            [...history].reverse().map((h: any, i: number) => (
              <div key={i} style={{
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    color: h.action === 'completed' ? 'var(--primary)'
                      : h.action === 'executed' ? 'var(--accent)'
                      : h.action === 'created' ? 'var(--txt)'
                      : 'var(--muted)',
                    textTransform: 'uppercase',
                    background: h.action === 'completed' ? 'rgba(0,255,65,0.15)'
                      : h.action === 'executed' ? 'rgba(5,217,232,0.15)'
                      : 'rgba(255,255,255,0.08)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.2rem',
                    border: `1px solid ${h.action === 'completed' ? 'rgba(0,255,65,0.4)'
                      : h.action === 'executed' ? 'rgba(5,217,232,0.4)'
                      : 'rgba(255,255,255,0.15)'}`,
                  }}>
                    {h.action === 'completed' ? '✓ ' : ''}{h.action}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(224,224,224,0.8)' }}>
                    {new Date(h.timestamp).toLocaleString('es-AR', {
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

                {h.note && (
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

                {h.details?.output && (
                  <div style={{
                    marginTop: '0.4rem',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0,255,65,0.15)',
                    borderRadius: '0.4rem',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#e0e0e0',
                    maxHeight: '200px',
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

                {h.details && !h.details.output && Object.entries(h.details)
                  .filter(([k]) => k !== 'cron_job_id')
                  .map(([k, v]) => (
                    <div key={k} style={{ fontSize: '0.65rem', color: 'rgba(224,224,224,0.75)', marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--accent)', opacity: 0.7 }}>{k}:</span>{' '}
                      <span>{String(v)}</span>
                    </div>
                  ))
                }
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── ResponseModal ─────────────────────────────────────────────────────────────

function ResponseModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const history = task.history || []
  // Find all entries with output, newest first
  const responses = [...history]
    .reverse()
    .filter((h: any) => h.details?.output)
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.75)',
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
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={14} style={{ color: 'var(--primary)' }} />
              Response
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{task.title}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: '0.25rem',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
          {responses.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
              No response data available
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
                      {new Date(h.timestamp).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(String(h.details.output))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      fontSize: '0.7rem', padding: '0.3rem 0.6rem',
                      background: copied ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.06)',
                      color: copied ? 'var(--primary)' : 'var(--txt)',
                      border: `1px solid ${copied ? 'rgba(0,255,65,0.3)' : 'var(--border)'}`,
                      borderRadius: '0.3rem', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
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
                    maxHeight: '50vh',
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
  onClose,
}: {
  tasks: Task[]
  onRestore: (t: Task) => void
  onDelete: (t: Task) => void
  onClose: () => void
}) {
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
  const [responseTask, setResponseTask] = useState<Task | null>(null)

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

  const addNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => tasksApi.addHistoryNote(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const tasks: Task[] = tasksData?.tasks ?? []
  const archived: Task[] = archivedData?.archived ?? []
  const profiles: Profile[] = profilesData?.profiles ?? []

  // Clean up executingTaskIds when tasks are no longer in_progress
  useEffect(() => {
    if (executingTaskIds.size === 0) return
    const toRemove: string[] = []
    for (const id of executingTaskIds) {
      const task = tasks.find(t => t.id === id)
      if (task && task.status !== 'in_progress') {
        toRemove.push(id)
      }
    }
    if (toRemove.length > 0) {
      setExecutingTaskIds(prev => {
        const next = new Set(prev)
        for (const id of toRemove) next.delete(id)
        return next
      })
    }
  }, [tasks, executingTaskIds])

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

  const handleOpenResponse = (t: Task) => {
    setResponseTask(t)
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

  const handleAddNote = (id: string, note: string) => addNoteMutation.mutate({ id, note })

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
              Archive {doneOrFailedCount} Done
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
            onResponse={handleOpenResponse}
          />
        ))}
      </div>

      {showModal && (
        <TaskModal
          task={editingTask || {}}
          profiles={profiles}
          onClose={() => { setShowModal(false); setEditingTask(null) }}
          onSave={handleSave}
          onAddNote={handleAddNote}
          isNew={!editingTask?.id}
        />
      )}

      {showArchived && (
        <ArchivedView
          tasks={archived}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onClose={() => setShowArchived(false)}
        />
      )}

      {historyTask && (
        <HistoryModal
          task={historyTask}
          onClose={() => setHistoryTask(null)}
        />
      )}

      {responseTask && (
        <ResponseModal
          task={responseTask}
          onClose={() => setResponseTask(null)}
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