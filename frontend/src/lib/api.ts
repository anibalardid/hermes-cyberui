import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ── Sessions ────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: () => api.get<Session[]>('/sessions').then(r => r.data),
  get: (id: string) => api.get<{ id: string; title: string; messages: Message[] }>(`/sessions/${id}`).then(r => r.data),
  create: () => api.post<{ id: string; title: string }>('/sessions').then(r => r.data),
  update: (id: string, data: { title?: string }) => api.put(`/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/${id}`).then(r => r.data),
  sendMessage: (id: string, data: { message: string; model?: string }) =>
    api.post(`/sessions/${id}/chat`, data),
}

// ── Skills ──────────────────────────────────────────────────────────────────
export const skillsApi = {
  list: () => api.get<{ skills: Skill[] }>('/skills').then(r => r.data),
  get: (name: string) => api.get<SkillDetail>(`/skills/${name}`).then(r => r.data),
  create: (data: { name: string; description?: string }) => api.post('/skills', data).then(r => r.data),
  update: (name: string, data: { content?: string; description?: string }) =>
    api.put(`/skills/${name}`, data).then(r => r.data),
  delete: (name: string) => api.delete(`/skills/${name}`).then(r => r.data),
}

// ── Memory ──────────────────────────────────────────────────────────────────
export const memoryApi = {
  get: () => api.get<{ memory: string; user: string }>('/memory').then(r => r.data),
  save: (data: { memory?: string; user?: string }) => api.put('/memory', data).then(r => r.data),
}

// ── Crons ────────────────────────────────────────────────────────────────────
export const cronsApi = {
  list: () => api.get<{ jobs: CronJob[]; updated_at: string }>('/crons').then(r => r.data),
  get: (jobId: string) => api.get<CronJobDetail>(`/crons/${jobId}`).then(r => r.data),
  update: (jobId: string, data: { name?: string; schedule?: string; enabled?: boolean; deliver?: string }) =>
    api.put(`/crons/${jobId}`, data).then(r => r.data),
  runNow: (jobId: string) => api.post(`/crons/${jobId}/run`).then(r => r.data),
}

// ── Plugins ─────────────────────────────────────────────────────────────────
export const pluginsApi = {
  list: () => api.get<{ plugins: Plugin[] }>('/plugins').then(r => r.data),
  get: (name: string) => api.get<PluginDetail>(`/plugins/${name}`).then(r => r.data),
}

// ── Logs ─────────────────────────────────────────────────────────────────────
export const logsApi = {
  get: (logType: string, offset = 0, limit = 300, search?: string) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
    if (search) params.set('search', search)
    return api.get<LogResponse>(`/logs/${logType}?${params}`).then(r => r.data)
  },
}

// ── Files ─────────────────────────────────────────────────────────────────────
export const filesApi = {
  browse: (path: string) => api.get<FilesBrowseResponse>(`/files/browse?path=${encodeURIComponent(path)}`).then(r => r.data),
  read: (path: string) => api.get<FilesReadResponse>(`/files/read?path=${encodeURIComponent(path)}`).then(r => r.data),
  write: (path: string, content: string) => api.put(`/files/write?path=${encodeURIComponent(path)}`, { content }).then(r => r.data),
}

export interface FilesBrowseResponse {
  path: string
  entries: FileEntry[]
  file?: FileEntry
  error?: string
}

export interface FileEntry {
  name: string
  type: 'file' | 'dir'
  size: number
  modified: number
}

export interface FilesReadResponse {
  path: string
  content: string
  size: number
}

// ── Profiles ─────────────────────────────────────────────────────────────────
export const profilesApi = {
  list: () => api.get<{ profiles: Profile[]; active: string | null }>('/profiles').then(r => r.data),
  get: (name: string) => api.get<ProfileDetail>(`/profiles/${name}`).then(r => r.data),
  create: (data: { name: string; description?: string; model?: string; provider?: string }) =>
    api.post('/profiles', data).then(r => r.data),
  update: (name: string, data: Record<string, unknown>) =>
    api.put(`/profiles/${name}`, data).then(r => r.data),
  activate: (name: string) =>
    api.post(`/profiles/${name}/activate`).then(r => r.data),
}

// ── Multi-Agent ──────────────────────────────────────────────────────────────
export const multiagentApi = {
  config: () => api.get<MultiagentConfig>('/multiagent/config').then(r => r.data),
  agents: () => api.get<AgentsResponse>('/multiagent/agents').then(r => r.data),
  updateConfig: (data: Record<string, unknown>) => api.put('/multiagent/config', data).then(r => r.data),
}

// ── System ───────────────────────────────────────────────────────────────────
export const systemApi = {
  info: () => api.get<SystemInfo>('/system').then(r => r.data),
  config: () => api.get<Record<string, unknown>>('/system/config').then(r => r.data),
  gatewayStatus: () => api.get<GatewayStatus>('/system/gateway').then(r => r.data),
  networkInfo: () => api.get<NetworkInfo>('/system/network').then(r => r.data),
  usage: () => api.get<UsageStats>('/system/usage').then(r => r.data),
  gatewayRestart: () => api.post('/system/gateway/restart').then(r => r.data),
}

export interface NetworkInfo {
  hostname: string
  addresses: { type: string; address: string; port: number }[]
}

export interface GatewayStatus {
  running: boolean
  pid: number | null
  state: Record<string, unknown> | null
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface Session {
  id: string
  title: string
  created: string
  updated: string
  message_count: number
  model?: string
  platform?: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  title?: string
  model?: string
}

export interface Skill {
  name: string
  description: string
  path: string
  has_skill_md: boolean
  has_readme: boolean
}

export interface SkillDetail extends Skill {
  skill_md: string
  readme: string
}

export interface CronJob extends CronJobDetail {
  id: string
  name: string
  schedule: string
  repeat: number | null
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  deliver: string | null
  model: string | null
  provider: string | null
}

export interface CronJobDetail {
  id: string
  name: string
  schedule: string
  repeat: number | null
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  deliver: string | null
  model: string | null
  provider: string | null
  prompt: string
  script?: string
}

export interface Plugin {
  name: string
  path: string
  description: string
  version?: string
  author?: string
}

export interface PluginDetail extends Plugin {
  metadata: Record<string, unknown>
  readme: string
  config: string
}

export interface LogResponse {
  log_type: string
  file: string
  total_lines: number
  offset: number
  limit: number
  lines: string[]
}

export interface Profile {
  name: string
  path: string
  description: string
  model?: string
  provider?: string
}

export interface ProfileDetail {
  name: string
  path: string
  config: Record<string, unknown>
}

export interface MultiagentConfig {
  config: Record<string, unknown>
  file: string
}

export interface AgentsResponse {
  agents: Agent[]
  state: string
}

export interface Agent {
  name: string
  display_name: string
  model?: string
  fallback?: string
  channel_id: string
  channel_name: string
  description?: string
  status: string
}

export interface SystemInfo {
  platform: string
  platform_version: string
  hostname: string
  cpu_count: number
  cpu_percent: number | null
  cpu_per_core: number[] | null
  memory_total_gb: number | null
  memory_used_gb: number | null
  memory_percent: number | null
  disk_total_gb: number | null
  disk_used_gb: number | null
  disk_percent: number | null
  session_count: number
  skill_count: number
  uptime: string
}

export interface UsageStats {
  totals: {
    sessions: number
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_write_tokens: number
    reasoning_tokens: number
    estimated_cost_usd: number
    actual_cost_usd: number
  }
  recent: {
    id: string
    source: string
    model: string
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
    billing_provider: string | null
  }[]
  error?: string
}

// ── Jobs Feed ──────────────────────────────────────────────────────────────
export interface JobsFeed {
  hermes: { status: string | null; platform: string | null }
  summary: {
    total_jobs: number
    scheduled: number
    paused: number
    errors: number
    active_sessions: number
    recent_sessions: number
  }
  jobs: {
    scheduled: JobInfo[]
    paused: JobInfo[]
    errors: JobInfo[]
  }
  sessions: {
    active: SessionInfo[]
    recent: SessionInfo[]
  }
  updated_at: string
}

export interface JobInfo {
  id: string
  name: string
  schedule: string
  state: string
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  deliver: string | null
  model: string | null
  provider: string | null
  repeat_completed: number | null
  repeat_times: number | null
}

export interface SessionInfo {
  id: string
  source: string
  model: string
  title: string
  started_at: string
  ended_at: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  duration_seconds: number
  active: boolean
}

export const jobsApi = {
  feed: () => api.get<JobsFeed>('/jobs').then(r => r.data),
  history: (jobId: string) => api.get<{ job: JobInfo }>(`/jobs/${jobId}/history`).then(r => r.data),
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  profile: string
  due_date: string | null
  created_at: string
  updated_at: string
  history: TaskHistoryEntry[]
}

export interface TaskHistoryEntry {
  timestamp: string
  action: string
  from_status: string | null
  to_status: string | null
  note: string | null
  details: Record<string, unknown> | null
}

export const tasksApi = {
  list: () => api.get<{ tasks: Task[]; updated_at: string }>('/tasks').then(r => r.data),
  get: (id: string) => api.get<Task>(`/tasks/${id}`).then(r => r.data),
  create: (data: Partial<Task>) => api.post<Task>('/tasks', data).then(r => r.data),
  update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data),
  move: (id: string, status: string) => api.patch<Task>(`/tasks/${id}/status`, { status }).then(r => r.data),
  execute: (id: string) => api.post<Task>(`/tasks/${id}/execute`).then(r => r.data),
  archive: (id: string) => api.post<Task>(`/tasks/${id}/archive`).then(r => r.data),
  archiveAllDone: () => api.post<{ archived_count: number }>('/tasks/archive-all-done').then(r => r.data),
  delete: (id: string) => api.delete(`/tasks/${id}`).then(r => r.data),
  getHistory: (id: string) => api.get<{ history: TaskHistoryEntry[] }>(`/tasks/${id}/history`).then(r => r.data),
  addHistoryNote: (id: string, note: string) =>
    api.post(`/tasks/${id}/history`, { note }).then(r => r.data),
  listArchived: () => api.get<{ archived: Task[] }>('/tasks/archived/list').then(r => r.data),
  restore: (id: string) => api.post<Task>(`/tasks/${id}/restore`).then(r => r.data),
  gatewayStatus: () => api.get<{ ticker_alive: boolean; last_tick_age_secs: number | null; gateway_pid: number | null; error?: string }>('/tasks/gateway/status').then(r => r.data),
}

// ── Config ─────────────────────────────────────────────────────────────────
export const configApi = {
  get: () => api.get<ConfigData>('/config').then(r => r.data),
}

export interface ConfigData {
  sections: Record<string, Record<string, unknown>>
  configVersion: number | null
  full: Record<string, unknown>
}
