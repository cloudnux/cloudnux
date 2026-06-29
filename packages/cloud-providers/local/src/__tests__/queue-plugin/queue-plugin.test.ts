import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

import { queuesPlugin } from '../../queue-plugin';
import type { QueueConfig } from '../../queue-plugin/types';
import { logger, runWithLogContext, subscribeToLogs } from '../../logger';

/**
 * Behavior suite for queue-plugin's timer/scheduling logic, exercised only
 * through the public `app.queues` decorator surface. Dispatch latency is
 * bounded by `tickIntervalMs` (the single global tick), so tests set it
 * small to keep fake-timer advances easy to reason about.
 */

const buildApp = async (config?: Partial<QueueConfig>): Promise<FastifyInstance> => {
  const app = Fastify();
  // Mirrors router/index.ts's decoration - queue-plugin reads `app.logging`
  // rather than importing the logger directly, so it needs to be present
  // before the plugin registers, same as in the real composition root.
  app.decorate('logging', { ...logger, runWithLogContext, subscribeToLogs });
  await app.register(queuesPlugin, {
    config: {
      persistence: { enabled: false },
      ...config,
    } as Partial<QueueConfig>,
  });
  await app.ready();
  return app;
};

describe('queue-plugin', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    vi.useRealTimers();
    if (app) {
      await app.close();
    }
  });

  describe('queue lifecycle', () => {
    it('adds, lists, and removes a queue', async () => {
      app = await buildApp();
      const handler = vi.fn().mockResolvedValue(undefined);

      await app.queues.addQueue('orders', handler);

      expect(app.queues.hasQueue('orders')).toBe(true);
      expect(app.queues.listQueues()).toContain('orders');

      await app.queues.removeQueue('orders');

      expect(app.queues.hasQueue('orders')).toBe(false);
      expect(app.queues.listQueues()).not.toContain('orders');
    });

    it('ignores adding a duplicate queue without throwing', async () => {
      app = await buildApp();
      const handlerA = vi.fn().mockResolvedValue(undefined);
      const handlerB = vi.fn().mockResolvedValue(undefined);

      await app.queues.addQueue('orders', handlerA);
      await expect(app.queues.addQueue('orders', handlerB)).resolves.not.toThrow();

      expect(app.queues.listQueues()).toEqual(['orders']);
    });
  });

  describe('batch dispatch', () => {
    it('processes a full batch on the next tick once batchSize is reached', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 2, batchWindowMs: 5000, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      await app.queues.enqueueMessage('q1', { n: 2 }, {});

      // dispatch happens on the next tick, not instantly - bounded by tickIntervalMs
      await vi.advanceTimersByTimeAsync(1);

      expect(handler).toHaveBeenCalledTimes(2);
      const stats = app.queues.getQueueStats('q1')!;
      expect(stats.incoming).toHaveLength(0);
      expect(stats.processing).toHaveLength(0);
    });

    it('processes a partial batch after batchWindowMs elapses', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 500, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);

      expect(handler).toHaveBeenCalledTimes(1);
      const stats = app.queues.getQueueStats('q1')!;
      expect(stats.incoming).toHaveLength(0);
    });
  });

  describe('delayed messages', () => {
    it('holds a delayed message until x-delay-seconds elapses', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 100, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, { 'x-delay-seconds': '2' });

      // batch window passes, but the message isn't ready yet
      await vi.advanceTimersByTimeAsync(150);
      expect(handler).not.toHaveBeenCalled();

      // now past the 2s delay
      await vi.advanceTimersByTimeAsync(2000);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry & DLQ', () => {
    it('retries with exponential backoff then moves to DLQ after maxRetries', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 2, retryBackoff: true, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue({ failureId: 'boom' });
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});

      await vi.advanceTimersByTimeAsync(10); // batch window -> attempt 1
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200); // backoff after attempts=1 (2^1*100ms) -> attempt 2
      expect(handler).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(400); // backoff after attempts=2 (2^2*100ms) -> attempt 3, hits maxRetries -> DLQ
      expect(handler).toHaveBeenCalledTimes(3);

      const summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(1);
      expect(summary.messages.processing).toHaveLength(0);
    });

    it('batches a pending retry together with other ready messages instead of dispatching it alone', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 3, retryBackoff: true, tickIntervalMs: 1 });
      const handler = vi.fn()
        .mockResolvedValueOnce({ failureId: 'boom' }) // first call (message A) fails
        .mockResolvedValue(undefined); // every call after succeeds
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 'A' }, {});
      await vi.advanceTimersByTimeAsync(10); // batch dispatch -> A fails, retry scheduled (~200ms backoff)
      expect(handler).toHaveBeenCalledTimes(1);

      // while A waits out its backoff it should be sitting in the ready
      // pool (`incoming`), not parked in `processing` waiting on a timer of
      // its own - that's what makes it eligible to be batched with anything
      // else that's ready, instead of being dispatched alone.
      let summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.incoming).toHaveLength(1);
      expect(summary.messages.processing).toHaveLength(0);

      await app.queues.enqueueMessage('q1', { n: 'B' }, {}); // a fresh message arrives while A is waiting

      await vi.advanceTimersByTimeAsync(200); // A's backoff elapses
      expect(handler).toHaveBeenCalledTimes(3); // 1 (A fail) + 1 (A retry) + 1 (B), same batch dispatch

      summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.incoming).toHaveLength(0);
      expect(summary.messages.processing).toHaveLength(0);
      expect(summary.messages.dlq).toHaveLength(0);
    });
  });

  describe('DLQ operations', () => {
    it('processDlq moves DLQ messages back to incoming and they get reprocessed', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 0, tickIntervalMs: 1 });
      const handler = vi
        .fn()
        .mockResolvedValueOnce({ failureId: 'boom' })
        .mockResolvedValue(undefined);
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      await vi.advanceTimersByTimeAsync(10); // maxRetries=0 -> straight to DLQ on first failure
      expect(handler).toHaveBeenCalledTimes(1);

      let summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(1);

      const result = await app.queues.processDlq('q1');
      expect(result?.processed).toBe(1);

      await vi.advanceTimersByTimeAsync(10); // batch window for the requeued message

      expect(handler).toHaveBeenCalledTimes(2);
      summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(0);
      expect(summary.messages.processing).toHaveLength(0);
    });

    it('purgeDlq clears the DLQ without reprocessing', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 0, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue({ failureId: 'boom' });
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      await vi.advanceTimersByTimeAsync(10);

      let summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(1);

      const result = await app.queues.purgeDlq('q1');
      expect(result?.purged).toBe(1);

      summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(0);
    });
  });

  describe('removeQueue safety', () => {
    it('does not throw when removing a queue with a pending retry scheduled', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 3, retryBackoff: true, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue({ failureId: 'boom' });
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      await vi.advanceTimersByTimeAsync(10); // first attempt fails, retry scheduled ~200ms out
      expect(handler).toHaveBeenCalledTimes(1);

      await expect(app.queues.removeQueue('q1')).resolves.not.toThrow();
      expect(app.queues.hasQueue('q1')).toBe(false);

      // advance past when the pending retry would have fired - the queue is
      // gone from the runtime's `queues` map, so the tick simply never sees
      // it again (nothing to orphan, unlike the old per-message setTimeout)
      await vi.advanceTimersByTimeAsync(1000);

      expect(app.queues.hasQueue('q1')).toBe(false);
      expect(app.queues.listQueues()).not.toContain('q1');
    });
  });

  describe('retryBackoff disabled', () => {
    // Previously a bug: a failed message was incremented once and then never
    // retried and never moved to DLQ - stuck in `processing` forever. Fixed:
    // retryBackoff only controls whether there's a backoff delay between
    // attempts, not whether retries happen at all - so it still retries
    // (immediately) and eventually DLQs once maxRetries is hit.
    it('still retries without delay and eventually moves to DLQ once maxRetries is hit', async () => {
      vi.useFakeTimers();
      app = await buildApp({ batchSize: 10, batchWindowMs: 10, maxRetries: 2, retryBackoff: false, tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue({ failureId: 'boom' });
      await app.queues.addQueue('q1', handler);

      await app.queues.enqueueMessage('q1', { n: 1 }, {});
      await vi.advanceTimersByTimeAsync(10); // batch window -> attempt 1
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50); // no backoff delay - retries cascade tick by tick
      expect(handler).toHaveBeenCalledTimes(3); // 1 initial + 2 retries, same total as maxRetries=2 with backoff

      const summary = app.queues.getQueueSummary('q1')!;
      expect(summary.messages.dlq).toHaveLength(1);
      expect(summary.messages.processing).toHaveLength(0);
    });
  });
});
