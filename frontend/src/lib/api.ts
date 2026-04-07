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
  gatewayRestart: () => api.post<{ ok: boolean; message: string; new_pid?: number }>('/system/gateway/restart').then(r => r.data),
  networkInfo: () => api.get<NetworkInfo>('/system/network').then(r => r.data),
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

export interface CronJob {
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
