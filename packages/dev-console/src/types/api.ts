export interface RouteInfo {
  method: string | string[]
  url: string
  handler: string
  registeredAt: string
  module?: string
}

export interface RoutesResponse {
  routes: RouteInfo[]
}

export interface RegistryStats {
  totalRoutes: number
  registeredAt: string
}

export interface HttpHistoryEntry {
  id: string
  method: string
  routeUrl: string
  url: string
  statusCode: number
  duration: number
  reqId: string
  requestHeaders: Record<string, unknown>
  requestBody?: unknown
  timestamp: string
}

export interface HttpHistoryResponse {
  history: HttpHistoryEntry[]
}

export interface QueueStats {
  incoming: number
  processing: number
  dlq: number,
  configuration?: {
    batchSize: number;
    batchWindowMs: number;
    maxRetries: number;
    parallel: boolean;
    maxConcurrent: number;
    retryBackoff: boolean;
    persistence: {
      enabled: boolean;
      directory: string;
      saveInterval: number;
      saveOnShutdown: boolean;
      loadOnStartup: boolean;
    };
  }
}

export interface QueueInfo {
  name: string
  stats: QueueStats | null
}

export interface QueueDetails extends QueueInfo {
  messages: {
    incoming: any[]
    processing: any[]
    dlq: any[]
  }
}

export interface QueuesResponse {
  queues: QueueInfo[]
}

export interface QueueMessageHistoryEntry {
  id: string
  queueName: string
  status: 'completed' | 'failed'
  timestamp: string
  completedAt: string
  attempts: number
  payload: any
  attributes: Record<string, any>
  error?: string
}

export interface QueueHistoryResponse {
  history: QueueMessageHistoryEntry[]
}

export interface ScheduleInfo {
  name: string
  enabled: boolean
  isRunning: boolean
  cronExpression?: string
  timezone?: string
}

export interface ScheduleDetails extends ScheduleInfo {
  job: any
  timerId: string
}

export interface SchedulesResponse {
  schedules: ScheduleInfo[]
}

export interface ScheduleExecution {
  id: string
  jobId: string
  startTime: string
  endTime?: string
  status: 'running' | 'completed' | 'failed'
  error?: string
  result?: any
}

export interface ScheduleExecutionsResponse {
  executions: ScheduleExecution[]
}

export interface WebSocketConnection {
  connectionId: string
  path: string
  connectedAt: string
}

export interface WebSocketPath {
  path: string
  connections: WebSocketConnection[]
}

export interface WebSocketsResponse {
  paths: WebSocketPath[]
}

export interface WebSocketPathResponse {
  path: string
  connections: WebSocketConnection[]
}

export interface WebSocketInfo {
  path: string
  connectionCount: number
}

export interface EmailHistoryEntry {
  id: string
  messageId: string
  timestamp: string
  from: string
  to: string[]
  cc?: string[]
  subject: string
  preview: string
  hasAttachments: boolean
  attachmentCount?: number
  configurationSet?: string
  status: 'sent' | 'failed'
  error?: string
}

export interface EmailsResponse {
  emails: EmailHistoryEntry[]
}

export interface EmailDetailResponse {
  email: EmailHistoryEntry
}

export interface Module {
  name: string
  routes: RouteInfo[]
  queues: QueueInfo[]
  schedules: ScheduleInfo[]
  websockets?: WebSocketInfo[]
}

export interface ModulesResponse {
  modules: Module[]
}