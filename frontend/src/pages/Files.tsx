import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../lib/api'
import { FolderOpen, File, ChevronRight, Home, Edit3, Save, X, Eye, FileText } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import type { FileEntry } from '../lib/api'

const ROOT_PATH = ""

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('es-AR', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

function EntryRow({ entry, depth, onOpen, selected }: {
  entry: FileEntry
  depth: number
  onOpen: (name: string, isDir: boolean) => void
  selected: boolean
}) {
  const isDir = entry.type === 'dir'
  return (
    <div
      onClick={() => onOpen(entry.name, isDir)}
      onTouchEnd={(e) => { e.preventDefault(); onOpen(entry.name, isDir) }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 0.75rem', cursor: 'pointer',
        background: selected ? 'rgba(5,217,232,0.1)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(5,217,232,0.3)' : 'transparent'}`,
        borderRadius: '0.375rem', marginLeft: `${depth * 1.25}rem`,
        transition: 'all 0.1s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {isDir
        ? <FolderOpen size={14} style={{ color: '#05d9e8', flexShrink: 0 }} />
        : <File size={14} style={{ color: '#6b6b8a', flexShrink: 0 }} />
      }
      <span style={{ fontSize: '0.8rem', color: isDir ? '#05d9e8' : 'var(--txt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.name}
      </span>
      {!isDir && (
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{formatSize(entry.size)}</span>
      )}
      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', flexShrink: 0, minWidth: '100px', textAlign: 'right' }}>
        {formatDate(entry.modified)}
      </span>
    </div>
  )
}

// Mobile file viewer modal
function FileViewerModal({ path, content, onClose, onEdit, isEditing, editContent, onEditChange, onSave, onCancelEdit, saveStatus, writePending }: {
  path: string
  content: string
  onClose: () => void
  onEdit: () => void
  isEditing: boolean
  editContent: string
  onEditChange: (v: string) => void
  onSave: () => void
  onCancelEdit: () => void
  saveStatus: string | null
  writePending: boolean
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.2s ease-out'
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      {/* Modal header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
          <X size={18} />
        </button>
        <span style={{ fontSize: '0.8rem', color: '#05d9e8', fontFamily: 'JetBrains Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
        {!isEditing && (
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '0.375rem', fontSize: '0.75rem', background: 'rgba(245,212,0,0.1)', border: '1px solid rgba(245,212,0,0.4)', cursor: 'pointer', color: '#f5d400', flexShrink: 0 }}>
            <Edit3 size={12} />Editar
          </button>
        )}
      </div>
      {/* Modal body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isEditing ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <Edit3 size={12} style={{ color: '#f5d400' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flex: 1 }}>Editing</span>
              {saveStatus === 'saved' && <span style={{ fontSize: '0.75rem', color: '#00ff41' }}>Guardado</span>}
              {saveStatus === 'error' && <span style={{ fontSize: '0.75rem', color: '#ff4444' }}>Error al guardar</span>}
            </div>
            <textarea
              value={editContent}
              onChange={e => onEditChange(e.target.value)}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                background: 'var(--bg)', color: '#00ff41',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
                lineHeight: 1.6, padding: '1rem', overflow: 'auto',
              }}
              spellCheck={false}
            />
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button onClick={onCancelEdit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.5rem', borderRadius: '0.375rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={14} />Cancelar
              </button>
              <button onClick={onSave} disabled={writePending} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0.5rem', borderRadius: '0.375rem', fontSize: '0.8rem', background: '#00ff41', border: '1px solid #00ff41', cursor: 'pointer', color: '#000' }}>
                <Save size={14} />{writePending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
            <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--txt)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Files() {
  const qc = useQueryClient()
  const isMobile = useIsMobile()
  const [currentPath, setCurrentPath] = useState(ROOT_PATH)
  const [pathHistory, setPathHistory] = useState<string[]>([])
  const [viewingFile, setViewingFile] = useState<string | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['files-browse', currentPath],
    queryFn: () => filesApi.browse(currentPath),
  })

  const readMutation = useMutation({
    mutationFn: (path: string) => filesApi.read(path),
    onSuccess: (data, path) => {
      setViewingFile(path)
      setEditingFile(null)
      setEditContent(data.content)
    }
  })

  const writeMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.write(path, content),
    onSuccess: () => {
      setSaveStatus('saved')
      qc.invalidateQueries({ queryKey: ['files-browse', currentPath] })
      setTimeout(() => setSaveStatus(null), 2000)
    },
    onError: () => {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  })

  const navigateTo = useCallback((path: string) => {
    if (path === currentPath) return
    if (viewingFile) setViewingFile(null)
    if (editingFile) setEditingFile(null)
    setPathHistory(h => [...h, currentPath])
    setCurrentPath(path)
  }, [currentPath, viewingFile, editingFile])

  const navigateBack = useCallback(() => {
    if (pathHistory.length === 0) return
    const prev = pathHistory[pathHistory.length - 1]
    setPathHistory(h => h.slice(0, -1))
    setCurrentPath(prev)
  }, [pathHistory])

  const openEntry = useCallback((name: string, isDir: boolean) => {
    if (isDir) {
      const newPath = currentPath ? `${currentPath}/${name}` : name
      navigateTo(newPath)
    } else {
      const filePath = currentPath ? `${currentPath}/${name}` : name
      readMutation.mutate(filePath)
    }
  }, [currentPath, navigateTo, readMutation])

  const startEdit = useCallback(() => {
    setEditingFile(viewingFile)
    setSaveStatus(null)
  }, [viewingFile])

  const cancelEdit = useCallback(() => {
    setEditingFile(null)
    setEditContent('')
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingFile) return
    writeMutation.mutate({ path: editingFile, content: editContent })
  }, [editingFile, editContent, writeMutation])

  const closeViewer = useCallback(() => {
    setViewingFile(null)
    setEditingFile(null)
    setEditContent('')
  }, [])

  const pathParts = currentPath.split('/').filter(Boolean)

  // Mobile: show viewer modal when file is selected
  const showMobileViewer = isMobile && viewingFile

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 4, height: '2rem', background: '#05d9e8', borderRadius: 2, boxShadow: '0 0 12px rgba(5,217,232,0.6)' }} />
          <div>
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#05d9e8', textShadow: '0 0 8px rgba(5,217,232,0.4)', margin: 0 }}>FILES</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '2px 0 0' }}>~/.hermes file browser</p>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigateTo('')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#05d9e8', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
          >
            <Home size={13} />~
          </button>
          {pathParts.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
              <button
                onClick={() => navigateTo(pathParts.slice(0, i + 1).join('/'))}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: i === pathParts.length - 1 ? 'var(--txt)' : '#05d9e8', fontSize: '0.8rem', fontFamily: 'inherit', padding: '2px 4px', borderRadius: '4px' }}
              >
                {part}
              </button>
            </span>
          ))}
          {pathHistory.length > 0 && (
            <button
              onClick={navigateBack}
              style={{ marginLeft: '0.5rem', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* Main: file list (mobile) or browser+viewer (desktop) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list — full width on mobile */}
        <div style={{
          width: isMobile ? '100%' : '42rem',
          borderRight: isMobile ? 'none' : '1px solid var(--border)',
          overflow: 'auto', padding: '0.75rem', flexShrink: 0
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: '2.5rem', borderRadius: '0.375rem', background: 'var(--surf)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', color: '#ff4444', fontSize: '0.875rem' }}>Error loading directory</div>
          ) : data?.error ? (
            <div style={{ padding: '1rem', color: '#ff4444', fontSize: '0.875rem' }}>{data.error}</div>
          ) : data?.entries.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Directorio vacio</div>
          ) : (
            <div>
              {/* Column headers — hidden on mobile */}
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', marginBottom: '0.25rem' }}>
                  <span style={{ flex: 1, fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Tamano</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>Modificado</span>
                </div>
              )}
              {data?.entries.map((entry) => (
                <EntryRow
                  key={entry.name}
                  entry={entry}
                  depth={0}
                  onOpen={openEntry}
                  selected={viewingFile === (currentPath ? `${currentPath}/` : '') + entry.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop file viewer/editor */}
        {!isMobile && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!viewingFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.875rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <FileText size={32} style={{ margin: '0 auto 0.75rem', display: 'block', color: 'var(--border)' }} />
                  Selecciona un archivo para ver su contenido
                </div>
              </div>
            ) : editingFile ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <Edit3 size={14} style={{ color: '#f5d400' }} />
                  <span style={{ fontSize: '0.8rem', color: '#f5d400', fontFamily: 'JetBrains Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingFile}</span>
                  {saveStatus === 'saved' && <span style={{ fontSize: '0.75rem', color: '#00ff41' }}>Guardado</span>}
                  {saveStatus === 'error' && <span style={{ fontSize: '0.75rem', color: '#ff4444' }}>Error al guardar</span>}
                  <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '0.375rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={12} />Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={writeMutation.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '0.375rem', fontSize: '0.75rem', background: '#00ff41', border: '1px solid #00ff41', cursor: 'pointer', color: '#000' }}
                  >
                    <Save size={12} />{writeMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none',
                    background: 'var(--bg)', color: '#00ff41',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
                    lineHeight: 1.6, padding: '1rem', overflow: 'auto',
                  }}
                  spellCheck={false}
                />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <Eye size={14} style={{ color: '#05d9e8' }} />
                  <span style={{ fontSize: '0.8rem', color: '#05d9e8', fontFamily: 'JetBrains Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewingFile}</span>
                  <button onClick={closeViewer} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '0.375rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={12} />Cerrar
                  </button>
                  <button
                    onClick={startEdit}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '0.375rem', fontSize: '0.75rem', background: 'rgba(245,212,0,0.1)', border: '1px solid rgba(245,212,0,0.4)', cursor: 'pointer', color: '#f5d400' }}
                  >
                    <Edit3 size={12} />Editar
                  </button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                  <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--txt)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                    {editContent}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile file viewer modal */}
      {showMobileViewer && (
        <FileViewerModal
          path={viewingFile}
          content={editContent}
          onClose={closeViewer}
          onEdit={startEdit}
          isEditing={!!editingFile}
          editContent={editContent}
          onEditChange={setEditContent}
          onSave={saveEdit}
          onCancelEdit={cancelEdit}
          saveStatus={saveStatus}
          writePending={writeMutation.isPending}
        />
      )}

      <style>{`
        @keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
      `}</style>
    </div>
  )
}