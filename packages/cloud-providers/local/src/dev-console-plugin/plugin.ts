import path from "path";
import { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fsPlugin from "fastify-plugin";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { WebSocketConnectionGoneError } from "@cloudnux/core-cloud-provider";

import "../logger/types";

import "../queue-plugin";
import "../schedule-plugin";
import "../websocket-plugin";

import { routeRegistry } from "./route-registry";

interface LogEntry {
  id: string;
  timestamp: Date;
  levelName: string;
  message: string;
  meta?: Record<string, unknown>;
  module: string;
  reqId: string;
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
    this.listeners.forEach(listener => listener(entry));
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
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

export interface DevConsolePluginOptions {
  prefix?: string;
  enableUI?: boolean;
}

async function devConsolePluginFunction(
  fastify: FastifyInstance,
  options: DevConsolePluginOptions = {}
) {
  const { prefix = 'console', enableUI = true } = options;

  // Read off `fastify.logging` (decorated once by router/index.ts on the shared
  // FastifyInstance), not a direct `../logger` import - dev-console-plugin is its
  // own separately-bundled tsup entry, so a direct import would get its own
  // disconnected copy of the logger's listeners Set and never see logs published
  // from queue-plugin/schedule-plugin/websocket-plugin's bundles.
  const unsubscribe = fastify.logging.subscribeToLogs((entry) => {
    logStore.addLog({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      timestamp: new Date(entry.time),
      levelName: entry.levelName,
      message: entry.msg,
      meta: entry.meta,
      module: entry.module,
      reqId: entry.reqId,
    });
  });

  // Unsubscribe and clear log store on plugin teardown
  fastify.addHook('onClose', (_instance, done) => {
    unsubscribe();
    logStore.clear();
    done();
  });

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
    const wsManager = fastify.websockets;

    if (!queueManager || !schedulerManager || !wsManager) {
      return reply.status(503).send({ error: 'Services not available' });
    }

    // Get all routes and filter HTTP routes by prefix
    const allRoutes = routeRegistry.getAll();
    const httpRoutes = allRoutes;

    // Get all modules from routes, queues, schedules, and websockets
    const moduleSet = new Set<string>();

    httpRoutes.forEach(route => {
      if (route.module) moduleSet.add(route.module);
    });

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

    wsManager.getRegisteredPaths().forEach(p => {
      if (p.module) moduleSet.add(p.module);
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

      // Get websockets for this module
      const moduleWebSockets = wsManager
        ? wsManager.getRegisteredPaths(moduleName).map(p => ({
          path: p.path,
          connectionCount: wsManager.getConnections(p.path).length
        }))
        : [];

      return {
        name: moduleName,
        routes: moduleRoutes,
        queues: moduleQueues,
        schedules: moduleSchedules,
        websockets: moduleWebSockets
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
        console.log(`Processing message in ${queueName}:`, message);
        return undefined;
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
      module,
      reqId,
    } = request.query as {
      limit?: number;
      level?: string;
      module?: string;
      reqId?: string;
    };

    let logs = logStore.getLogs(Number(limit));

    if (level) {
      logs = logs.filter(log => log.levelName === level);
    }

    if (module) {
      logs = logs.filter(log => log.module === module);
    }

    if (reqId) {
      logs = logs.filter(log => log.reqId === reqId);
    }

    return { logs };
  });

  fastify.delete(`/${prefix}/logs`, async () => {
    logStore.clear();
    return { status: 'success', message: 'Logs cleared' };
  });

  // WebSocket endpoints
  fastify.get(`/${prefix}/websockets`, async (_, reply) => {
    const wsManager = fastify.websockets;
    if (!wsManager) {
      return reply.status(503).send({ error: 'WebSocket service not available' });
    }

    const connections = wsManager.getConnections();
    const pathSet = new Set(connections.map(c => c.path));
    const paths = Array.from(pathSet).map(p => ({
      path: p,
      connections: wsManager.getConnections(p).map(c => ({
        connectionId: c.connectionId,
        path: c.path,
        connectedAt: c.connectedAt,
      })),
    }));

    return { paths };
  });

  fastify.get(`/${prefix}/websockets/:path`, async (request, reply) => {
    const wsManager = fastify.websockets;
    if (!wsManager) {
      return reply.status(503).send({ error: 'WebSocket service not available' });
    }

    const { path: wsPath } = request.params as { path: string };
    const decodedPath = '/' + wsPath;
    const connections = wsManager.getConnections(decodedPath).map(c => ({
      connectionId: c.connectionId,
      path: c.path,
      connectedAt: c.connectedAt,
    }));

    return { path: decodedPath, connections };
  });

  fastify.post(`/${prefix}/websockets/:connectionId/send`, async (request, reply) => {
    const wsManager = fastify.websockets;
    if (!wsManager) {
      return reply.status(503).send({ error: 'WebSocket service not available' });
    }

    const { connectionId } = request.params as { connectionId: string };

    try {
      await wsManager.sendToClient(connectionId, request.body);
      return reply.status(200).send({ status: 'success', message: `Message sent to ${connectionId}` });
    } catch (error) {
      if (error instanceof WebSocketConnectionGoneError) {
        return reply.status(410).send({ error: error.message });
      }
      return reply.status(404).send({ error: (error as Error).message });
    }
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
    const devConsolePath = path.dirname(
      require.resolve('@cloudnux/dev-console/dist/index.html')
    );

    await fastify.register(fastifyStatic, {
      root: devConsolePath,
      decorateReply: true,
      prefix: `/${prefix}/`
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