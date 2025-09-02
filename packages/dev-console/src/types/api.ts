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

export interface Module {
  name: string
  routes: RouteInfo[]
  queues: QueueInfo[]
  schedules: ScheduleInfo[]
}

export interface ModulesResponse {
  modules: Module[]
}