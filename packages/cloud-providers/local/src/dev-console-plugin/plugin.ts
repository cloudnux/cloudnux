import path from "path";
import { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fsPlugin from "fastify-plugin";
import "../queue-plugin";
import "../schedule-plugin";

import { routeRegistry } from "./route-registry";

// Simple in-memory log store
interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  meta?: Record<string, any>;
  source?: string;
  module?: string;
  trigger?: string;
  triggerType?: 'http' | 'queue' | 'schedule';
}

class LogStore {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: ((log: LogEntry) => void)[] = [];

  addLog(entry: LogEntry) {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener(entry));
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  getLogsByLevel(level: string, limit = 100) {
    return this.logs.filter(log => log.level === level).slice(0, limit);
  }

  getLogsByModule(module: string, limit = 100) {
    return this.logs.filter(log => log.module === module).slice(0, limit);
  }

  getLogsByTrigger(triggerType: string, triggerName: string, limit = 100) {
    return this.logs.filter(log => 
      log.triggerType === triggerType && log.trigger === triggerName
    ).slice(0, limit);
  }

  clear() {
    this.logs = [];
  }

  subscribe(listener: (log: LogEntry) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

const logStore = new LogStore();

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

const captureConsoleLog = (level: LogEntry['level'], originalMethod: any) => {
  return (...args: any[]) => {
    // Call original method
    originalMethod.apply(console, args);
    
    // Extract message and detect context
    const message = args.join(' ');
    let source = 'unknown';
    let module: string | undefined;
    let trigger: string | undefined;
    let triggerType: LogEntry['triggerType'] | undefined;
    
    // Detect source and extract context
    if (message.includes('Queue') || message.includes('queue')) {
      source = 'queue';
      triggerType = 'queue';
      
      // Extract queue name from patterns like "Queue added: event-trigger-queue"
      const queueMatch = message.match(/queue[:\s]+([a-zA-Z0-9_-]+)/i);
      if (queueMatch) trigger = queueMatch[1];
    } else if (message.includes('Schedule') || message.includes('job')) {
      source = 'schedule';
      triggerType = 'schedule';
      
      // Extract job name from patterns like "Job added: run-schedule"
      const jobMatch = message.match(/(?:job|schedule)[:\s]+([a-zA-Z0-9_-]+)/i);
      if (jobMatch) trigger = jobMatch[1];
    } else if (message.includes('HTTP') || message.includes('api') || message.includes('/api/')) {
      source = 'http';
      triggerType = 'http';
      
      // Extract route from patterns like "HTTP handler for /api/users"
      const routeMatch = message.match(/\/api\/[^\s]+/);
      if (routeMatch) trigger = routeMatch[0];
    }
    
    // Extract module from common patterns
    const moduleMatch = message.match(/module[:\s]+([a-zA-Z0-9_-]+)/i) || 
                       message.match(/\[([a-zA-Z0-9_-]+)\]/) ||
                       message.match(/in\s+([a-zA-Z0-9_-]+)\s+module/i);
    if (moduleMatch) module = moduleMatch[1];
    
    // Add to log store
    logStore.addLog({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      message: message.replace(/\x1b\[[0-9;]*m/g, ''), // Remove ANSI colors
      source,
      module,
      trigger,
      triggerType
    });
  };
};

// Setup console interception
console.error = captureConsoleLog('error', originalConsole.error);
console.warn = captureConsoleLog('warn', originalConsole.warn);
console.info = captureConsoleLog('info', originalConsole.info);
console.log = captureConsoleLog('info', originalConsole.log);
console.debug = captureConsoleLog('debug', originalConsole.debug);

export interface DevConsolePluginOptions {
  prefix?: string;
  enableUI?: boolean;
}

async function devConsolePluginFunction(
  fastify: FastifyInstance,
  options: DevConsolePluginOptions = {}
) {
  const { prefix = 'console', enableUI = true } = options;

  // Register route discovery hook for all routes
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.prefix === "/api") {
      routeRegistry.register(routeOptions);
    }
  });

  // API endpoints
  fastify.get(`/${prefix}/routes`, async () => {
    return { routes: routeRegistry.getAll() };
  });

  fastify.get(`/${prefix}/routes/:method`, async (request) => {
    const { method } = request.params as { method: string };
    return { routes: routeRegistry.getByMethod(method) };
  });

  fastify.get(`/${prefix}/registry/stats`, async () => {
    return {
      totalRoutes: routeRegistry.count(),
      registeredAt: new Date()
    };
  });

  // Modules endpoints - group resources by module
  fastify.get(`/${prefix}/modules`, async (_, reply) => {
    const queueManager = fastify.queues;
    const schedulerManager = fastify.scheduler;

    if (!queueManager || !schedulerManager) {
      return reply.status(503).send({ error: 'Services not available' });
    }

    // Get all routes and filter HTTP routes by prefix
    const allRoutes = routeRegistry.getAll();
    const httpRoutes = allRoutes;

    // Get all modules from routes, queues, and schedules
    const moduleSet = new Set<string>();

    // Collect module names from routes
    httpRoutes.forEach(route => {
      if (route.module) moduleSet.add(route.module);
    });

    // Collect module names from queues and schedules
    const allQueueNames = queueManager.listQueues();
    const allJobNames = schedulerManager.listJobs();

    allQueueNames.forEach(queueName => {
      const queueStats = queueManager.getQueueStats(queueName);
      if (queueStats?.module) moduleSet.add(queueStats.module);
    });

    allJobNames.forEach(jobName => {
      const jobStats = schedulerManager.getJobStats(jobName);
      if (jobStats?.job.module) moduleSet.add(jobStats.job.module);
    });

    // Create module objects
    const modules = Array.from(moduleSet).map(moduleName => {
      // Get routes for this module
      const moduleRoutes = httpRoutes.filter(route => route.module === moduleName);

      // Get queues for this module
      const moduleQueueNames = queueManager.listQueues(moduleName);
      const moduleQueues = moduleQueueNames.map(name => {
        const stats = queueManager.getQueueStats(name);
        return {
          name,
          stats: stats ? {
            incoming: stats.incoming.length,
            processing: stats.processing.length,
            dlq: stats.dlq.length
          } : null
        };
      });

      // Get schedules for this module
      const moduleJobNames = schedulerManager.listJobs(moduleName);
      const moduleSchedules = moduleJobNames.map(name => {
        const jobStats = schedulerManager.getJobStats(name);
        return {
          name,
          enabled: jobStats?.job.enabled || false,
          isRunning: jobStats?.isRunning || false,
          cronExpression: jobStats?.job.cronExpression,
          timezone: jobStats?.job.timezone
        };
      });

      return {
        name: moduleName,
        routes: moduleRoutes,
        queues: moduleQueues,
        schedules: moduleSchedules
      };
    });

    return { modules };
  });

  // Queues endpoints - access via decorator
  fastify.get(`/${prefix}/queues`, async (_, reply) => {
    const queueManager = fastify.queues;
    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    const queueNames = queueManager.listQueues();
    const queues = queueNames.map(name => {
      const stats = queueManager.getQueueStats(name);
      return {
        name,
        stats: stats ? {
          incoming: stats.incoming.length,
          processing: stats.processing.length,
          dlq: stats.dlq.length
        } : null
      };
    });

    return { queues };
  });

  fastify.get(`/${prefix}/queues/:queueName`, async (request, reply) => {
    const { queueName } = request.params as { queueName: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    const queueStats = queueManager.getQueueStats(queueName);
    if (!queueStats) {
      return reply.status(404).send({ error: 'Queue not found' });
    }

    const config = queueManager.getConfig();

    return {
      name: queueName,
      stats: {
        incoming: queueStats.incoming.length,
        processing: queueStats.processing.length,
        dlq: queueStats.dlq.length,
        configuration: config
      },
      messages: {
        incoming: queueStats.incoming,
        processing: queueStats.processing,
        dlq: queueStats.dlq
      }
    };
  });

  // Queue action endpoints
  fastify.get(`/${prefix}/queues/:queueName/process-dlq`, async (request, reply) => {
    const { queueName } = request.params as { queueName: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    try {
      const result = await queueManager.processDlq(queueName);
      return reply.status(200).send(result);
    } catch (error) {
      return reply.status(500).send({
        message: 'Failed to process DLQ',
        error
      });
    }
  });

  fastify.get(`/${prefix}/queues/:queueName/purge-dlq`, async (request, reply) => {
    const { queueName } = request.params as { queueName: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    try {
      const result = await queueManager.purgeDlq(queueName);
      return reply.status(200).send(result);
    } catch (error) {
      return reply.status(500).send({
        message: 'Failed to purge DLQ',
        error
      });
    }
  });

  fastify.post(`/${prefix}/queues/:queueName/enqueue`, async (request, reply) => {
    const { queueName } = request.params as { queueName: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    try {
      const result = await queueManager.enqueueMessage(queueName, request.body, request.headers as Record<string, any>);
      return reply.status(200).send(result);
    } catch (error) {
      return reply.status(500).send({
        message: 'Failed to enqueue message',
        error
      });
    }
  });

  fastify.delete(`/${prefix}/queues/:queueName`, async (request, reply) => {
    const { queueName } = request.params as { queueName: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    try {
      await queueManager.removeQueue(queueName);
      return reply.status(200).send({
        status: 'success',
        message: `Queue ${queueName} removed successfully`
      });
    } catch (error) {
      return reply.status(500).send({
        message: 'Failed to remove queue',
        error
      });
    }
  });

  fastify.post(`/${prefix}/queues`, async (request, reply) => {
    const { queueName, module } = request.body as { queueName: string; module?: string };
    const queueManager = fastify.queues;

    if (!queueManager) {
      return reply.status(503).send({ error: 'Queue service not available' });
    }

    if (!queueName) {
      return reply.status(400).send({ error: 'Queue name is required' });
    }

    try {
      // Simple handler that logs messages
      const handler = async (message: any) => {
        // eslint-disable-next-line no-console
        console.log(`Processing message in ${queueName}:`, message);
      };

      await queueManager.addQueue(queueName, handler, module);
      return reply.status(201).send({
        status: 'success',
        message: `Queue ${queueName} created successfully`,
        queueName
      });
    } catch (error) {
      return reply.status(500).send({
        message: 'Failed to create queue',
        error
      });
    }
  });

  // Schedules endpoints - access via decorator
  fastify.get(`/${prefix}/schedules`, async (_, reply) => {
    const schedulerManager = fastify.scheduler;
    if (!schedulerManager) {
      return reply.status(503).send({ error: 'Scheduler service not available' });
    }

    const jobNames = schedulerManager.listJobs();
    const jobs = jobNames.map(name => {
      const jobStats = schedulerManager.getJobStats(name);
      return {
        name,
        enabled: jobStats?.job.enabled || false,
        isRunning: jobStats?.isRunning || false,
        cronExpression: jobStats?.job.cronExpression,
        timezone: jobStats?.job.timezone
      };
    });

    return { schedules: jobs };
  });

  fastify.get(`/${prefix}/schedules/:jobName`, async (request, reply) => {
    const { jobName } = request.params as { jobName: string };
    const schedulerManager = (fastify as any).scheduler;

    if (!schedulerManager) {
      return reply.status(503).send({ error: 'Scheduler service not available' });
    }

    const jobStats = schedulerManager.getJobStats(jobName);
    if (!jobStats) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return {
      name: jobName,
      job: jobStats.job,
      isRunning: jobStats.isRunning,
      timerId: jobStats.timerId ? 'scheduled' : 'not_scheduled'
    };
  });

  // Schedule action endpoints - use decorators
  fastify.post(`/${prefix}/schedules/:jobName/trigger`, async (request, reply) => {
    const { jobName } = request.params as { jobName: string };
    const schedulerManager = fastify.scheduler;

    if (!schedulerManager) {
      return reply.status(503).send({ error: 'Scheduler service not available' });
    }

    try {
      await schedulerManager.triggerJob(jobName);
      return reply.status(200).send({
        status: 'success',
        message: `Schedule ${jobName} triggered successfully`
      });
    } catch {
      return reply.status(500).send({ error: 'Failed to trigger schedule' });
    }
  });

  fastify.put(`/${prefix}/schedules/:jobName/enable`, async (request, reply) => {
    const { jobName } = request.params as { jobName: string };
    const schedulerManager = fastify.scheduler;

    if (!schedulerManager) {
      return reply.status(503).send({ error: 'Scheduler service not available' });
    }

    try {
      await schedulerManager.enableJob(jobName);
      return reply.status(200).send({
        status: 'success',
        message: `Schedule ${jobName} enabled successfully`
      });
    } catch {
      return reply.status(500).send({ error: 'Failed to enable schedule' });
    }
  });

  fastify.put(`/${prefix}/schedules/:jobName/disable`, async (request, reply) => {
    const { jobName } = request.params as { jobName: string };
    const schedulerManager = fastify.scheduler;

    if (!schedulerManager) {
      return reply.status(503).send({ error: 'Scheduler service not available' });
    }

    try {
      await schedulerManager.disableJob(jobName);
      return reply.status(200).send({
        status: 'success',
        message: `Schedule ${jobName} disabled successfully`
      });
    } catch {
      return reply.status(500).send({ error: 'Failed to disable schedule' });
    }
  });

  // Logs endpoints
  fastify.get(`/${prefix}/logs`, async (request) => {
    const { 
      limit = 100, 
      level, 
      source, 
      module, 
      trigger, 
      triggerType 
    } = request.query as { 
      limit?: number; 
      level?: string; 
      source?: string; 
      module?: string;
      trigger?: string;
      triggerType?: string;
    };
    
    let logs = logStore.getLogs(Number(limit));
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    if (source) {
      logs = logs.filter(log => log.source === source);
    }
    
    if (module) {
      logs = logs.filter(log => 
        log.module === module || 
        log.message.toLowerCase().includes(module.toLowerCase())
      );
    }
    
    if (trigger && triggerType) {
      logs = logs.filter(log => 
        (log.trigger === trigger && log.triggerType === triggerType) ||
        log.message.toLowerCase().includes(trigger.toLowerCase())
      );
    }
    
    return { logs };
  });

  fastify.delete(`/${prefix}/logs`, async () => {
    logStore.clear();
    return { status: 'success', message: 'Logs cleared' };
  });

  // Server-Sent Events for real-time logs
  fastify.get(`/${prefix}/logs/stream`, async (request, reply) => {
    reply.type('text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('Access-Control-Allow-Origin', '*');
    
    // Send initial logs
    const initialLogs = logStore.getLogs(50);
    reply.raw.write(`data: ${JSON.stringify({ type: 'initial', logs: initialLogs })}\n\n`);
    
    // Subscribe to new logs
    const unsubscribe = logStore.subscribe((log) => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'log', log })}\n\n`);
    });
    
    // Cleanup on client disconnect
    request.raw.on('close', () => {
      unsubscribe();
    });
  });

  // Serve static UI files if enabled
  if (enableUI) {
    const devConsolePath = path.resolve(__dirname, '../../../packages/dev-console/dist');

    await fastify.register(fastifyStatic, {
      root: devConsolePath,
      decorateReply: true
    });

    // Serve dev-console SPA
    fastify.get(`/${prefix}`, async (_, reply) => {
      return reply.sendFile('index.html');
    });
  }
}

export const devConsolePlugin = fsPlugin(devConsolePluginFunction, {
  name: 'dev-console-plugin'
})