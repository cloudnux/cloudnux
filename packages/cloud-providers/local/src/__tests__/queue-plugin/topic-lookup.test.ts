import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

import { queuesPlugin } from '../../queue-plugin';
import type { QueueConfig } from '../../queue-plugin/types';
import { logger, runWithLogContext, subscribeToLogs } from '../../logger';

// Same registration as the generated dev server: the queue plugin under /queues
const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify();
  app.decorate('logging', { ...logger, runWithLogContext, subscribeToLogs });
  await app.register(queuesPlugin, {
    prefix: 'queues',
    config: { persistence: { enabled: false } } as Partial<QueueConfig>,
  });
  await app.ready();
  return app;
};

describe('queue-plugin lookups used to check notification targets', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /queues/topics/:topic lists the subscribers, 404 without any', async () => {
    app = await buildApp();
    await app.queues.addQueue('invoice-events--invoices--process', vi.fn().mockResolvedValue(undefined), 'invoices');
    app.queues.subscribeTopic('invoice-events', 'invoice-events--invoices--process');

    const found = await app.inject({ method: 'GET', url: '/queues/topics/invoice-events' });
    const missing = await app.inject({ method: 'GET', url: '/queues/topics/nope' });

    expect(found.statusCode).toBe(200);
    expect(found.json()).toEqual({ topicName: 'invoice-events', subscribers: ['invoice-events--invoices--process'] });
    expect(missing.statusCode).toBe(404);
  });

  it('GET /queues/:queue answers 404 for an unknown queue', async () => {
    app = await buildApp();
    await app.queues.addQueue('invoice-processing', vi.fn().mockResolvedValue(undefined), 'invoices');

    expect((await app.inject({ method: 'GET', url: '/queues/invoice-processing' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/queues/nope' })).statusCode).toBe(404);
  });
});
