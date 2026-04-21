#!/usr/bin/env node
/**
 * Screenshot generator for README with FAKE data.
 * Uses Playwright route interception to replace API responses with demo data.
 * Usage: cd .../webui-cyber && HOME=/Users/anibal node scripts/screenshot-demo.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:23689';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// ── Fake Data ──────────────────────────────────────────────────────────────────

const FAKE_SYSTEM = {
  platform: 'Darwin',
  platform_version: 'Darwin Kernel Version 25.2.0',
  hostname: 'hermes-server.local',
  cpu_count: 12,
  cpu_percent: 23.4,
  cpu_per_core: [32.0, 28.5, 15.2, 12.0, 8.1, 5.3, 3.2, 2.1, 1.8, 1.5, 1.2, 0.8],
  memory_total_gb: 64.0,
  memory_used_gb: 28.7,
  memory_percent: 44.8,
  disk_total_gb: 2048.0,
  disk_used_gb: 387.2,
  disk_percent: 18.9,
  session_count: 1247,
  skill_count: 52,
  uptime: '2026-04-20T08:00:00.000000',
};

const FAKE_NETWORK = {
  hostname: 'hermes-server.local',
  addresses: [
    { type: 'LAN', address: '192.168.1.42', port: 23689 },
    { type: 'Network', address: '100.64.0.15', port: 23689 },
    { type: 'External (WAN)', address: '203.0.113.42', port: 23689 },
  ],
};

const FAKE_USAGE = {
  totals: {
    sessions: 1247,
    input_tokens: 892_345_678,
    output_tokens: 12_456_789,
    cache_read_tokens: 345_000_000,
    cache_write_tokens: 45_000_000,
    reasoning_tokens: 2_345_678,
    estimated_cost_usd: 142.57,
    actual_cost_usd: 98.34,
  },
  recent: [
    { id: 'demo_001', source: 'telegram', model: 'glm-5.1', input_tokens: 1_234_567, output_tokens: 8_432, estimated_cost_usd: 2.45, billing_provider: 'custom' },
    { id: 'demo_002', source: 'discord', model: 'claude-sonnet-4', input_tokens: 892_345, output_tokens: 12_567, estimated_cost_usd: 4.12, billing_provider: 'anthropic' },
    { id: 'demo_003', source: 'cli', model: 'glm-5.1', input_tokens: 567_890, output_tokens: 6_543, estimated_cost_usd: 1.23, billing_provider: 'custom' },
    { id: 'demo_004', source: 'api_server', model: 'deepseek-v3', input_tokens: 2_345_678, output_tokens: 23_456, estimated_cost_usd: 0.89, billing_provider: 'custom' },
    { id: 'demo_005', source: 'web', model: 'glm-5.1', input_tokens: 345_678, output_tokens: 3_456, estimated_cost_usd: 0.56, billing_provider: 'custom' },
  ],
};

const FAKE_SESSIONS = [
  { id: 'demo_sess_001', title: 'Set up CI/CD pipeline for backend services', created: '2026-04-20T09:15:00', updated: '2026-04-20T09:45:00', message_count: 28, model: 'glm-5.1', platform: 'cli', source: 'db' },
  { id: 'demo_sess_002', title: 'Competitive analysis for fintech startup', created: '2026-04-20T08:30:00', updated: '2026-04-20T10:20:00', message_count: 45, model: 'glm-5.1', platform: 'telegram', source: 'db' },
  { id: 'demo_sess_003', title: 'Debug memory leak in production', created: '2026-04-20T07:00:00', updated: '2026-04-20T08:15:00', message_count: 32, model: 'claude-sonnet-4', platform: 'discord', source: 'db' },
  { id: 'demo_sess_004', title: 'Generate quarterly report with charts', created: '2026-04-19T16:00:00', updated: '2026-04-19T17:30:00', message_count: 19, model: 'deepseek-v3', platform: 'web', source: 'db' },
  { id: 'demo_sess_005', title: 'Write deployment script for K8s', created: '2026-04-19T14:00:00', updated: '2026-04-19T15:45:00', message_count: 37, model: 'glm-5.1', platform: 'api_server', source: 'db' },
  { id: 'demo_sess_006', title: 'Refactor authentication module', created: '2026-04-19T11:00:00', updated: '2026-04-19T12:30:00', message_count: 22, model: 'glm-5.1', platform: 'cli', source: 'db' },
  { id: 'demo_sess_007', title: 'Research RAG architectures for legal docs', created: '2026-04-18T09:00:00', updated: '2026-04-18T11:00:00', message_count: 56, model: 'glm-5.1', platform: 'telegram', source: 'db' },
  { id: 'demo_sess_008', title: 'Set up monitoring with Prometheus', created: '2026-04-18T07:30:00', updated: '2026-04-18T09:00:00', message_count: 41, model: 'claude-sonnet-4', platform: 'discord', source: 'db' },
];

const FAKE_SKILLS = {
  skills: [
    { name: 'code-review', description: 'Automated code review with security scanning and best practices', path: '/home/hermes/skills/code-review', has_skill_md: true, has_readme: true },
    { name: 'deployment', description: 'Deploy applications to Kubernetes, Docker, and cloud platforms', path: '/home/hermes/skills/deployment', has_skill_md: true, has_readme: false },
    { name: 'testing', description: 'TDD workflow with pytest, coverage analysis, and CI integration', path: '/home/hermes/skills/testing', has_skill_md: true, has_readme: true },
    { name: 'research', description: 'Academic paper discovery, literature review, and market analysis', path: '/home/hermes/skills/research', has_skill_md: true, has_readme: false },
    { name: 'monitoring', description: 'Set up observability stacks: Prometheus, Grafana, Loki', path: '/home/hermes/skills/monitoring', has_skill_md: true, has_readme: true },
    { name: 'security-audit', description: 'Automated security scanning and vulnerability assessment', path: '/home/hermes/skills/security-audit', has_skill_md: true, has_readme: false },
    { name: 'data-pipeline', description: 'ETL pipeline design and implementation with Apache Airflow', path: '/home/hermes/skills/data-pipeline', has_skill_md: true, has_readme: true },
    { name: 'api-design', description: 'REST and GraphQL API design patterns and best practices', path: '/home/hermes/skills/api-design', has_skill_md: true, has_readme: false },
    { name: 'ml-ops', description: 'MLOps workflows: training, evaluation, deployment, monitoring', path: '/home/hermes/skills/ml-ops', has_skill_md: true, has_readme: true },
    { name: 'infra-as-code', description: 'Infrastructure as Code with Terraform, Pulumi, and CDK', path: '/home/hermes/skills/infra-as-code', has_skill_md: true, has_readme: false },
    { name: 'documentation', description: 'Auto-generate technical docs from code and architecture', path: '/home/hermes/skills/documentation', has_skill_md: true, has_readme: false },
    { name: 'incident-response', description: 'Automated incident detection, triage, and remediation', path: '/home/hermes/skills/incident-response', has_skill_md: true, has_readme: true },
  ],
};

const FAKE_MEMORY = {
  memory: `Project: NeoVault — Crypto Portfolio Manager. Stack: React 19+TS+Vite+TanStack Query, FastAPI Python backend, PostgreSQL. Deploy on k8s. Team lead: @marcos.dev.\n§\nStaging cluster: k3s on 192.168.1.50. Production: AWS EKS us-east-2. CI/CD via GitHub Actions + ArgoCD. Monitoring: Prometheus + Grafana on staging:3000.\n§\nAPI rate limits: free tier 100 req/min, pro 10k req/min. Auth: JWT with RS256, keys rotated monthly. Webhooks verify with HMAC-SHA256.\n§\nKnown issue: WebSocket reconnect drops messages after 30s idle — needs heartbeat. Priority: HIGH. Assigned: @elena.ops.\n§\nRelease cadence: biweekly on Tuesdays. Hotfixes go straight to main → ArgoCD auto-deploys. Tag format: v{MAJOR}.{MINOR}.{PATCH}.`,
  user: `Role: Senior backend engineer. Prefers Python with type hints. Code reviews require 2 approvals. Testing: pytest with 80%+ coverage. Deploys must pass all stages. Timezone: UTC-3 (ART).`,
};

const FAKE_CRONS = {
  jobs: [
    { id: 'a1b2c3d4e5f6', name: 'Daily Health Check', schedule: '0 6 * * *', repeat: { times: null, completed: 42 }, enabled: true, state: 'scheduled', next_run_at: '2026-04-21T06:00:00-03:00', last_run_at: '2026-04-20T06:02:15-03:00', last_status: 'ok', last_error: null, deliver: 'local', model: 'glm-5.1', provider: 'custom' },
    { id: 'f6e5d4c3b2a1', name: 'Security Scan', schedule: '0 3 * * 1', repeat: { times: null, completed: 8 }, enabled: true, state: 'scheduled', next_run_at: '2026-04-21T03:00:00-03:00', last_run_at: '2026-04-14T03:01:45-03:00', last_status: 'ok', last_error: null, deliver: 'discord:#security', model: 'glm-5.1', provider: 'custom' },
    { id: '1a2b3c4d5e6f', name: 'Database Backup', schedule: '0 2 * * *', repeat: { times: null, completed: 90 }, enabled: true, state: 'scheduled', next_run_at: '2026-04-21T02:00:00-03:00', last_run_at: '2026-04-20T02:05:30-03:00', last_status: 'ok', last_error: null, deliver: 'local', model: null, provider: null },
    { id: '6f5e4d3c2b1a', name: 'News Digest — Tech', schedule: '0 8 * * *', repeat: { times: null, completed: 30 }, enabled: true, state: 'scheduled', next_run_at: '2026-04-21T08:00:00-03:00', last_run_at: '2026-04-20T08:12:00-03:00', last_status: 'ok', last_error: null, deliver: 'telegram:#tech-news', model: 'glm-5.1', provider: 'custom' },
    { id: 'aabbccddee11', name: 'Cost Reporter', schedule: '0 9 * * 1-5', repeat: { times: null, completed: 65 }, enabled: false, state: 'paused', next_run_at: null, last_run_at: '2026-04-18T09:00:30-03:00', last_status: 'error', last_error: 'API rate limit exceeded', deliver: 'discord:#billing', model: 'glm-5.1', provider: 'custom' },
  ],
  updated_at: '2026-04-20T08:12:00',
};

const FAKE_PLUGINS = {
  plugins: [
    { name: 'sentinel-monitor', path: '/home/hermes/plugins/sentinel-monitor', description: 'Real-time system monitoring with anomaly detection and alerting', version: '2.1.0', author: 'Hermes Team' },
    { name: 'cloud-deploy', path: '/home/hermes/plugins/cloud-deploy', description: 'One-click deployment to AWS, GCP, and Azure', version: '1.4.2', author: 'DevOps Guild' },
    { name: 'data-sync', path: '/home/hermes/plugins/data-sync', description: 'Bidirectional sync between local files and cloud storage', version: '0.9.8', author: 'Hermes Team' },
  ],
};

const FAKE_TASKS = {
  tasks: [
    { id: 't-001', title: 'Implement OAuth2 flow', description: 'Add Google and GitHub OAuth2 callbacks with token refresh', status: 'in_progress', priority: 'high', tags: ['auth', 'backend'], profile: 'default', due_date: '2026-04-22', created_at: '2026-04-18T10:00:00', updated_at: '2026-04-20T09:30:00', history: [{ timestamp: '2026-04-18T10:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-002', title: 'Add rate limiting middleware', description: 'Implement sliding window rate limiter for API endpoints', status: 'todo', priority: 'high', tags: ['security', 'api'], profile: 'default', due_date: '2026-04-25', created_at: '2026-04-19T14:00:00', updated_at: '2026-04-19T14:00:00', history: [{ timestamp: '2026-04-19T14:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-003', title: 'Write API integration tests', description: 'Cover all CRUD endpoints with pytest fixtures', status: 'todo', priority: 'medium', tags: ['testing'], profile: 'default', due_date: null, created_at: '2026-04-19T15:00:00', updated_at: '2026-04-19T15:00:00', history: [{ timestamp: '2026-04-19T15:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-004', title: 'Set up Redis caching', description: 'Cache frequently accessed queries with Redis and TTL policies', status: 'backlog', priority: 'medium', tags: ['performance', 'backend'], profile: 'default', due_date: null, created_at: '2026-04-20T08:00:00', updated_at: '2026-04-20T08:00:00', history: [{ timestamp: '2026-04-20T08:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-005', title: 'Design database schema v2', description: 'Normalize tables and add indexes for query optimization', status: 'done', priority: 'high', tags: ['database', 'architecture'], profile: 'default', due_date: null, created_at: '2026-04-15T09:00:00', updated_at: '2026-04-18T16:00:00', history: [{ timestamp: '2026-04-15T09:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-006', title: 'Fix WebSocket reconnect bug', description: 'Messages dropped after 30s idle — add heartbeat mechanism', status: 'failed', priority: 'critical', tags: ['bug', 'websocket'], profile: 'default', due_date: '2026-04-21', created_at: '2026-04-17T11:00:00', updated_at: '2026-04-20T07:00:00', history: [{ timestamp: '2026-04-17T11:00:00', action: 'created', from_status: null, to_status: 'backlog', note: null, details: null }] },
    { id: 't-007', title: 'Add CI/CD pipeline', description: 'GitHub Actions with build, test, and deploy stages', status: 'done', priority: 'medium', tags: ['devops'], profile: 'default', due_date: null, created_at: '2026-04-14T10:00:00', updated_at: '2026-04-16T14:00:00', history: [] },
    { id: 't-008', title: 'Create API documentation', description: 'OpenAPI spec with examples and authentication guides', status: 'in_progress', priority: 'low', tags: ['docs'], profile: 'default', due_date: null, created_at: '2026-04-19T16:00:00', updated_at: '2026-04-20T10:00:00', history: [] },
  ],
  updated_at: '2026-04-20T10:00:00',
};

const FAKE_PROFILES = {
  profiles: [
    { name: 'default', path: '/home/hermes', description: 'Production profile with balanced settings', model: 'glm-5.1', provider: 'custom', is_default: true, is_active: true },
    { name: 'research', path: '/home/hermes/profiles/research', description: 'Optimized for deep research tasks', model: 'deepseek-v3', provider: 'custom', is_default: false, is_active: false },
    { name: 'code-review', path: '/home/hermes/profiles/code-review', description: 'Strict code review with security focus', model: 'claude-sonnet-4', provider: 'anthropic', is_default: false, is_active: false },
    { name: 'fast-ops', path: '/home/hermes/profiles/fast-ops', description: 'Quick operational tasks and monitoring', model: 'glm-5.1', provider: 'custom', is_default: false, is_active: false },
  ],
  active: 'default',
};

const FAKE_MULTIAGENT = {
  config: {
    state: 'IDLE',
    channels: {
      orchestrator: '1100000000000000001',
      ideas: '1100000000000000002',
      research: '1100000000000000003',
      analysis: '1100000000000000004',
      critic: '1100000000000000005',
      final: '1100000000000000006',
    },
    agents: {
      ideator: { name: 'Brainstorm Engine', model: 'glm-5.1', fallback: 'llama3', channel: 'ideas', description: 'Generates creative ideas and approaches' },
      researcher: { name: 'Deep Research Agent', model: 'deepseek-v3', fallback: 'glm-5.1', channel: 'research', description: 'Gathers and analyzes information' },
      analyst: { name: 'Critical Analyst', model: 'claude-sonnet-4', fallback: 'glm-5.1', channel: 'analysis', description: 'Provides detailed analysis and critique' },
      reviewer: { name: 'Quality Reviewer', model: 'glm-5.1', fallback: 'deepseek-v3', channel: 'critic', description: 'Reviews outputs for quality and accuracy' },
    },
  },
  file: '/home/hermes/multiagent.yaml',
};

const FAKE_AGENTS = {
  agents: [
    { name: 'ideator', display_name: 'Brainstorm Engine', model: 'glm-5.1', fallback: 'llama3', channel_id: 'ideas', channel_name: 'ideas', description: 'Generates creative ideas and approaches', status: 'idle' },
    { name: 'researcher', display_name: 'Deep Research Agent', model: 'deepseek-v3', fallback: 'glm-5.1', channel_id: 'research', channel_name: 'research', description: 'Gathers and analyzes information', status: 'idle' },
    { name: 'analyst', display_name: 'Critical Analyst', model: 'claude-sonnet-4', fallback: 'glm-5.1', channel_id: 'analysis', channel_name: 'analysis', description: 'Provides detailed analysis and critique', status: 'active' },
    { name: 'reviewer', display_name: 'Quality Reviewer', model: 'glm-5.1', fallback: 'deepseek-v3', channel_id: 'critic', channel_name: 'critic', description: 'Reviews outputs for quality and accuracy', status: 'idle' },
  ],
  state: 'IDLE',
};

const FAKE_JOBS_FEED = {
  hermes: { status: 'ok', platform: 'hermes-agent' },
  summary: { total_jobs: 5, scheduled: 4, paused: 1, errors: 0, active_sessions: 3, recent_sessions: 8 },
  jobs: {
    scheduled: [
      { id: 'a1b2c3d4e5f6', name: 'Daily Health Check', schedule: '0 6 * * *', state: 'scheduled', enabled: true, next_run_at: '2026-04-21T06:00:00-03:00', last_run_at: '2026-04-20T06:02:15-03:00', last_status: 'ok', last_error: null, deliver: 'local', model: 'glm-5.1', provider: 'custom', repeat_completed: 42, repeat_times: null },
      { id: 'f6e5d4c3b2a1', name: 'Security Scan', schedule: '0 3 * * 1', state: 'scheduled', enabled: true, next_run_at: '2026-04-21T03:00:00-03:00', last_run_at: '2026-04-14T03:01:45-03:00', last_status: 'ok', last_error: null, deliver: 'discord:#security', model: 'glm-5.1', provider: 'custom', repeat_completed: 8, repeat_times: null },
      { id: '1a2b3c4d5e6f', name: 'Database Backup', schedule: '0 2 * * *', state: 'scheduled', enabled: true, next_run_at: '2026-04-21T02:00:00-03:00', last_run_at: '2026-04-20T02:05:30-03:00', last_status: 'ok', last_error: null, deliver: 'local', model: null, provider: null, repeat_completed: 90, repeat_times: null },
      { id: '6f5e4d3c2b1a', name: 'News Digest — Tech', schedule: '0 8 * * *', state: 'scheduled', enabled: true, next_run_at: '2026-04-21T08:00:00-03:00', last_run_at: '2026-04-20T08:12:00-03:00', last_status: 'ok', last_error: null, deliver: 'telegram:#tech-news', model: 'glm-5.1', provider: 'custom', repeat_completed: 30, repeat_times: null },
    ],
    paused: [
      { id: 'aabbccddee11', name: 'Cost Reporter', schedule: '0 9 * * 1-5', state: 'paused', enabled: false, next_run_at: null, last_run_at: '2026-04-18T09:00:30-03:00', last_status: 'error', last_error: 'API rate limit exceeded', deliver: 'discord:#billing', model: 'glm-5.1', provider: 'custom', repeat_completed: 65, repeat_times: null },
    ],
    errors: [],
  },
  sessions: {
    active: [
      { id: 'demo_active_1', source: 'telegram', model: 'glm-5.1', title: 'Market analysis for Q2', started_at: '2026-04-20T09:00:00', ended_at: null, message_count: 23, tool_call_count: 8, input_tokens: 456789, output_tokens: 5678, estimated_cost_usd: 0.89, duration_seconds: 3600, active: true },
      { id: 'demo_active_2', source: 'discord', model: 'claude-sonnet-4', title: 'Code review — auth module', started_at: '2026-04-20T08:30:00', ended_at: null, message_count: 15, tool_call_count: 4, input_tokens: 234567, output_tokens: 3456, estimated_cost_usd: 1.23, duration_seconds: 5400, active: true },
    ],
    recent: [
      { id: 'demo_recent_1', source: 'cli', model: 'glm-5.1', title: 'Deploy v2.3.1 to staging', started_at: '2026-04-20T07:00:00', ended_at: '2026-04-20T07:45:00', message_count: 31, tool_call_count: 12, input_tokens: 678901, output_tokens: 8901, estimated_cost_usd: 1.45, duration_seconds: 2700, active: false },
      { id: 'demo_recent_2', source: 'api_server', model: 'deepseek-v3', title: 'Security audit report', started_at: '2026-04-20T06:00:00', ended_at: '2026-04-20T06:30:00', message_count: 18, tool_call_count: 6, input_tokens: 345678, output_tokens: 4567, estimated_cost_usd: 0.67, duration_seconds: 1800, active: false },
    ],
  },
  updated_at: '2026-04-20T10:00:00',
};

const FAKE_LOGS = {
  log_type: 'gateway',
  file: 'gateway.log',
  total_lines: 15842,
  offset: 0,
  limit: 80,
  lines: [
    '2026-04-20 09:15:32,129 INFO [gateway] Cron ticker started — interval 60s',
    '2026-04-20 09:15:32,135 INFO [gateway] Loaded 5 jobs from jobs.json',
    '2026-04-20 09:15:32,200 INFO [telegram] Bot connected @HermesAgent',
    '2026-04-20 09:15:32,205 INFO [discord] Bot connected — 3 guilds, 7 channels',
    '2026-04-20 09:15:33,001 INFO [gateway] API server listening on port 23689',
    '2026-04-20 09:16:32,100 INFO [cron] Tick — checking 5 scheduled jobs',
    '2026-04-20 09:17:32,100 INFO [cron] Tick — no jobs due',
    '2026-04-20 09:18:32,100 INFO [cron] Tick — no jobs due',
    '2026-04-20 09:19:15,450 INFO [telegram] Message received from @user123: "analyze this report"',
    '2026-04-20 09:19:15,500 INFO [session] New session started: demo_active_1',
    '2026-04-20 09:19:18,200 INFO [telegram] Response sent — 342 tokens in 2.7s',
    '2026-04-20 10:00:32,100 INFO [cron] Tick — checking 5 scheduled jobs',
    '2026-04-20 10:00:32,250 INFO [cron] Job "Daily Health Check" triggered',
    '2026-04-20 10:02:15,800 INFO [cron] Job "Daily Health Check" completed — status ok',
    '2026-04-20 10:15:00,100 WARN [rate-limit] API rate limit at 85% — 150/180 requests',
    '2026-04-20 10:30:00,200 INFO [discord] Command /deploy received from @devops_lead',
    '2026-04-20 10:30:05,100 INFO [session] New session started: demo_active_2',
    '2026-04-20 10:30:45,500 INFO [discord] Deploy v2.3.1 initiated to staging cluster',
    '2026-04-20 10:45:22,100 INFO [cron] Job "Cost Reporter" failed — API rate limit exceeded',
    '2026-04-20 10:45:22,150 WARN [cron] Retrying "Cost Reporter" in 300s',
    '2026-04-20 11:00:00,000 INFO [gateway] Health check passed — uptime 2h44m',
    '2026-04-20 11:00:32,100 INFO [cron] Tick — checking 4 scheduled jobs',
  ],
};

const FAKE_FILES = {
  path: '/home/hermes',
  entries: [
    { name: 'config.yaml', type: 'file', size: 2847, modified: 1745107200 },
    { name: 'cron', type: 'dir', size: 4096, modified: 1745083200 },
    { name: 'logs', type: 'dir', size: 4096, modified: 1745126400 },
    { name: 'plugins', type: 'dir', size: 4096, modified: 1745040000 },
    { name: 'profiles', type: 'dir', size: 4096, modified: 1744996800 },
    { name: 'sessions', type: 'dir', size: 4096, modified: 1745126400 },
    { name: 'skills', type: 'dir', size: 4096, modified: 1745040000 },
    { name: 'state.db', type: 'file', size: 5242880, modified: 1745126400 },
    { name: 'tasks.json', type: 'file', size: 12288, modified: 1745122800 },
    { name: 'webui-cyber', type: 'dir', size: 4096, modified: 1745126400 },
  ],
};

const FAKE_CONFIG = {
  sections: {
    model: { default: 'glm-5.1', provider: 'custom' },
    display: { compact: false, personality: 'professional', streaming: true, skin: 'tron', show_cost: true, tool_progress: 'all' },
    terminal: { backend: 'local', timeout: 300, cwd: '/home/hermes' },
    platforms: {
      telegram: { enabled: true, bot_token: '***REDACTED***', allowed_users: ['@user1', '@user2'] },
      discord: { enabled: true, bot_token: '***REDACTED***', guild_id: '110000000000000000' },
      api_server: { enabled: true, port: 23689, key: '***REDACTED***' },
    },
    cron: { max_concurrent: 3, default_timeout: 300, timezone: 'America/Argentina/Buenos_Aires' },
  },
  configVersion: 7,
  full: { model: { default: 'glm-5.1', provider: 'custom' }, display: {}, terminal: {}, platforms: {}, cron: {} },
};

const FAKE_GATEWAY = { running: true, pid: 54321, state: { ticker_alive: true } };

const FAKE_GATEWAY_TASKS = { ticker_alive: true, last_tick_age_secs: 45, gateway_pid: 54321 };

// ── Route interceptor ──────────────────────────────────────────────────────────

function setupFakeRoutes(page) {
  page.route('**/api/system', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SYSTEM) }));
  page.route('**/api/system/network', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_NETWORK) }));
  page.route('**/api/system/usage', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_USAGE) }));
  page.route('**/api/system/gateway', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_GATEWAY) }));
  page.route('**/api/system/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
  page.route('**/api/sessions**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SESSIONS) }));
  page.route('**/api/skills**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SKILLS) }));
  page.route('**/api/memory**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_MEMORY) }));
  page.route('**/api/crons**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_CRONS) }));
  page.route('**/api/plugins**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PLUGINS) }));
  page.route('**/api/tasks/gateway/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_GATEWAY_TASKS) }));
  page.route('**/api/tasks/archived/list', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ archived: [] }) }));
  page.route('**/api/tasks**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_TASKS) }));
  page.route('**/api/jobs**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_JOBS_FEED) }));
  page.route('**/api/logs/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_LOGS) }));
  page.route('**/api/files/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_FILES) }));
  page.route('**/api/profiles**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PROFILES) }));
  page.route('**/api/multiagent/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_MULTIAGENT) }));
  page.route('**/api/multiagent/agents', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_AGENTS) }));
  page.route('**/api/config**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_CONFIG) }));
}

// ── Pages to screenshot ────────────────────────────────────────────────────────

const PAGES = [
  { route: '/',                    name: 'dashboard',        wait: 3000 },
  { route: '/sessions',            name: 'sessions',         wait: 2000 },
  { route: '/conversations',       name: 'conversations',    wait: 3000 },
  { route: '/skills',              name: 'skills',           wait: 2000 },
  { route: '/memory',              name: 'memory',           wait: 2000 },
  { route: '/kanban',              name: 'kanban',           wait: 3000 },
  { route: '/crons',               name: 'crons',            wait: 2000 },
  { route: '/plugins',             name: 'plugins',          wait: 2000 },
  { route: '/logs',                name: 'logs',             wait: 3000 },
  { route: '/profiles',            name: 'profiles',         wait: 2000 },
  { route: '/multiagent',          name: 'multiagent',       wait: 2000 },
  { route: '/settings',            name: 'settings',         wait: 2000 },
  { route: '/files',               name: 'files',            wait: 2000 },
  { route: '/jobs',                name: 'jobs',             wait: 3000 },
  { route: '/config',              name: 'config',           wait: 2000 },
  { route: '/sessions/demo_sess_002', name: 'chat',          wait: 3000 },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Launching browser with fake data interception...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Set up fake API routes BEFORE navigating
  setupFakeRoutes(page);

  console.log(`\nGenerating ${PAGES.length} screenshots with fake data...\n`);

  for (const p of PAGES) {
    const url = `${BASE}${p.route}`;
    const filepath = path.join(OUT_DIR, `${p.name}.png`);
    console.log(`  ${p.name.padEnd(18)} ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(p.wait);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`  ${p.name.padEnd(18)} ✓`);
    } catch (err) {
      console.error(`  ${p.name.padEnd(18)} ✗ ${err.message}`);
    }
  }

  // Route for specific session messages (for Chat page)
  page.route('**/api/sessions/demo_sess_002**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'demo_sess_002', title: 'Competitive analysis for fintech startup', messages: [
    { role: 'user', content: 'I need a competitive analysis of the LATAM fintech market. Focus on the leading neobanks and credit alternatives.' },
    { role: 'assistant', content: '## Competitive Analysis — LATAM Fintech\n\n### Leading Neobanks\n\n| Company | Country | Users | Valuation |\n|---------|---------|-------|-----------|\n| Nubank | Brazil | 90M+ | $50B |\n| Mercado Pago | Regional | 45M | $15B* |\n| Ualá | Argentina | 5M | $2.5B |\n| Belvo | Mexico | B2B | $500M |\n\n### Credit Alternatives\n\n- **Nu Cripto**: AI-driven personal credit, 48h approval\n- **Kueski**: buy-now-pay-later in Mexico\n- **Addi**: merchant credit in Colombia\n\n### Opportunities\n\n1. **B2B factoring** — underserved Andean market\n2. **Crypto-collateralized lending** — 300% YoY growth\n3. **Embedded finance** — SaaS + fintech convergence\n\nWould you like me to go deeper into any segment?' },
    { role: 'user', content: 'Dive deeper into Nubank\'s business model and how their strategy could be replicated in Argentina.' },
    { role: 'assistant', content: '## Nubank: Business Model Analysis\n\n### Unit Economics\n\nNubank achieved **CAC $8** vs traditional banking **$150-300**. Marginal cost per user: **$0.80/month**.\n\n### Flywheel\n\n```\nFree account → Mass attraction\n      ↓\nCredit card → Primary monetization\n      ↓\nInvestments → Stickiness + AUM fees\n      ↓\nCrypto/insurance → Cross-sell\n```\n\n### Replicability in Argentina\n\n**Favorable factors:**\n- High mobile penetration (78%)\n- Low banked population (49%)\n- Favorable regulatory framework (Fintech Law 2023)\n\n**Challenges:**\n- Macro volatility — elevated credit risk\n- BCRA regulations cap rates\n- Growing competition from Ualá + Mercado Pago\n\n### Suggested Strategy\n\n1. **Vertical niche**: SME credit with alternative scoring\n2. **Partnerships**: integrate with local ERPs\n3. **Freemium model**: account + card, monetize on credit' },
  ] }) }));

  // ── Extra: Conversations with a chat open ─────────────────────────
  console.log('\n  Extra: conversations-chat with fake messages...');
  const FAKE_CHAT = {
    id: 'demo_sess_002',
    title: 'Competitive analysis for fintech startup',
    messages: [
      { role: 'user', content: 'I need a competitive analysis of the LATAM fintech market. Focus on the leading neobanks and credit alternatives.' },
      { role: 'assistant', content: '## Competitive Analysis — LATAM Fintech\n\n### Leading Neobanks\n\n| Company | Country | Users | Valuation |\n|---------|---------|-------|-----------|\n| Nubank | Brazil | 90M+ | $50B |\n| Mercado Pago | Regional | 45M | $15B* |\n| Ualá | Argentina | 5M | $2.5B |\n| Belvo | Mexico | B2B | $500M |\n\n### Credit Alternatives\n\n- **Nu Cripto**: AI-driven personal credit, 48h approval\n- **Kueski**: buy-now-pay-later in Mexico\n- **Addi**: merchant credit in Colombia\n\n### Opportunities\n\n1. **B2B factoring** — underserved Andean market\n2. **Crypto-collateralized lending** — 300% YoY growth\n3. **Embedded finance** — SaaS + fintech convergence\n\nWould you like me to go deeper into any segment?' },
      { role: 'user', content: 'Dive deeper into Nubank\'s business model and how their strategy could be replicated in Argentina.' },
      { role: 'assistant', content: '## Nubank: Business Model Analysis\n\n### Unit Economics\n\nNubank achieved **CAC $8** vs traditional banking **$150-300**. Marginal cost per user: **$0.80/month**.\n\n### Flywheel\n\n```\nFree account → Mass attraction\n      ↓\nCredit card → Primary monetization\n      ↓\nInvestments → Stickiness + AUM fees\n      ↓\nCrypto/insurance → Cross-sell\n```\n\n### Replicability in Argentina\n\n**Favorable factors:**\n- High mobile penetration (78%)\n- Low banked population (49%)\n- Favorable regulatory framework (Fintech Law 2023)\n\n**Challenges:**\n- Macro volatility — elevated credit risk\n- BCRA regulations cap rates\n- Growing competition from Ualá + Mercado Pago\n\n### Suggested Strategy\n\n1. **Vertical niche**: SME credit with alternative scoring\n2. **Partnerships**: integrate with local ERPs\n3. **Freemium model**: account + card, monetize on credit' },
    ],
  };

  page.route('**/api/sessions/demo_sess_002', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_CHAT) }));

  try {
    await page.goto(`${BASE}/conversations/telegram/demo_sess_002`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT_DIR, 'conversations-chat.png'), fullPage: false });
    console.log('  conversations-chat    ✓');
  } catch (err) {
    console.error(`  conversations-chat    ✗ ${err.message}`);
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to:', OUT_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});