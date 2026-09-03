import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

import { schedulerPlugin } from '../../schedule-plugin';
import type { SchedulerConfig } from '../../schedule-plugin/types';
import { logger, runWithLogContext, subscribeToLogs } from '../../logger';

/**
 * Behavior suite for schedule-plugin's timer/scheduling logic, exercised
 * only through the public `app.scheduler` decorator surface. Dispatch
 * latency is bounded by `tickIntervalMs` (the single global tick, mirroring
 * queue-plugin), so tests set it small to keep fake-timer advances easy to
 * reason about.
 */

const buildApp = async (config?: Partial<SchedulerConfig>): Promise<FastifyInstance> => {
  const app = Fastify();
  // Mirrors router/index.ts's decoration - schedule-plugin reads
  // `app.logging` rather than importing the logger directly.
  app.decorate('logging', { ...logger, runWithLogContext, subscribeToLogs });
  await app.register(schedulerPlugin, {
    config: {
      persistence: { enabled: false, directory: './.develop/.scheduler-data' },
      ...config,
    } as Partial<SchedulerConfig>,
  });
  await app.ready();
  return app;
};

describe('schedule-plugin', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    vi.useRealTimers();
    if (app) {
      await app.close();
    }
  });

  describe('job lifecycle', () => {
    it('adds, lists, and removes a job', async () => {
      app = await buildApp();
      const handler = vi.fn().mockResolvedValue(undefined);

      await app.scheduler.addJob({ name: 'sync', intervalMs: 1000, handler });

      expect(app.scheduler.hasJob('sync')).toBe(true);
      expect(app.scheduler.listJobs()).toContain('sync');

      await app.scheduler.removeJob('sync');

      expect(app.scheduler.hasJob('sync')).toBe(false);
      expect(app.scheduler.listJobs()).not.toContain('sync');
    });

    it('ignores adding a duplicate job without throwing', async () => {
      app = await buildApp();
      const handlerA = vi.fn().mockResolvedValue(undefined);
      const handlerB = vi.fn().mockResolvedValue(undefined);

      await app.scheduler.addJob({ name: 'sync', intervalMs: 1000, handler: handlerA });
      await expect(app.scheduler.addJob({ name: 'sync', intervalMs: 1000, handler: handlerB })).resolves.not.toThrow();

      expect(app.scheduler.listJobs()).toEqual(['sync']);
    });
  });

  describe('validation', () => {
    it('rejects a job with no timing source', async () => {
      app = await buildApp();
      const handler = vi.fn().mockResolvedValue(undefined);

      await expect(app.scheduler.addJob({ name: 'nothing', handler })).rejects.toThrow(/must specify/);
    });

    it('rejects an invalid cron expression', async () => {
      app = await buildApp();
      const handler = vi.fn().mockResolvedValue(undefined);

      await expect(
        app.scheduler.addJob({ name: 'bad-cron', cronExpression: 'not a cron', handler })
      ).rejects.toThrow(/Invalid cron expression/);
    });
  });

  describe('tick dispatch', () => {
    it('runs an interval job once intervalMs elapses, and again on the next interval', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'sync', intervalMs: 10, handler });

      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10);
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    // Existing behavior carried over from before this refactor: a
    // delay-only job (no cronExpression/intervalMs) has no "run once"
    // concept - calculateNextRunFromLastRun falls back to delayMs again
    // after every run, so it behaves like an interval job.
    it('keeps recurring at delayMs even though it has no intervalMs', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'delayed', delayMs: 10, handler });

      await vi.advanceTimersByTimeAsync(10);
      expect(handler).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('stops dispatching once maxRuns is reached', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'sync', intervalMs: 5, maxRuns: 2, handler });

      await vi.advanceTimersByTimeAsync(5);
      await vi.advanceTimersByTimeAsync(5);
      expect(handler).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(50);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('enable / disable', () => {
    it('does not dispatch a disabled job until it is enabled', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'sync', intervalMs: 5, enabled: false, handler });

      await vi.advanceTimersByTimeAsync(50);
      expect(handler).not.toHaveBeenCalled();

      await app.scheduler.enableJob('sync');
      await vi.advanceTimersByTimeAsync(5);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('stops dispatching a job once disabled', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'sync', intervalMs: 5, handler });

      await vi.advanceTimersByTimeAsync(5);
      expect(handler).toHaveBeenCalledTimes(1);

      await app.scheduler.disableJob('sync');
      await vi.advanceTimersByTimeAsync(50);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrency', () => {
    it('limits simultaneous runs to maxConcurrent, dispatching the rest once a slot frees', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1, execution: { maxConcurrent: 1, defaultTimeout: 5000 } });

      let releaseA: () => void;
      const handlerA = vi.fn().mockImplementation(() => new Promise<void>(resolve => { releaseA = resolve; }));
      const handlerB = vi.fn().mockResolvedValue(undefined);

      await app.scheduler.addJob({ name: 'a', intervalMs: 5, handler: handlerA });
      await app.scheduler.addJob({ name: 'b', intervalMs: 5, handler: handlerB });

      await vi.advanceTimersByTimeAsync(5);
      // Both jobs are due, but only one slot is available - 'a' is added
      // first and takes it, leaving 'b' waiting.
      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).not.toHaveBeenCalled();

      releaseA!();
      await vi.advanceTimersByTimeAsync(1); // next tick: a's slot is free, b dispatches
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('fails a job that exceeds defaultTimeout and still advances its nextRun', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1, execution: { maxConcurrent: 5, defaultTimeout: 5 } });
      const handler = vi.fn().mockImplementation(() => new Promise(() => { })); // never resolves
      await app.scheduler.addJob({ name: 'sync', intervalMs: 5, handler });

      await vi.advanceTimersByTimeAsync(5); // dispatch
      await vi.advanceTimersByTimeAsync(5); // timeout fires
      expect(handler).toHaveBeenCalledTimes(1);

      const stats = app.scheduler.getJobStats('sync')!;
      expect(stats.isRunning).toBe(false);

      const { executions } = app.scheduler.getExecutionsSummary();
      expect(executions.find(e => e.status === 'failed')).toBeTruthy();

      // finally block ran and recalculated nextRun even on failure, so the
      // job is dispatched again on its next interval.
      await vi.advanceTimersByTimeAsync(5);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerJob', () => {
    it('runs a job immediately regardless of its nextRun', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockResolvedValue(undefined);
      await app.scheduler.addJob({ name: 'sync', intervalMs: 100000, handler });

      await app.scheduler.triggerJob('sync');
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('throws when triggering a job that is already running', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockImplementation(() => new Promise(() => { }));
      await app.scheduler.addJob({ name: 'sync', intervalMs: 100000, handler });

      await app.scheduler.triggerJob('sync');
      await expect(app.scheduler.triggerJob('sync')).rejects.toThrow(/already running/);
    });

    it('throws when triggering a job that does not exist', async () => {
      app = await buildApp();
      await expect(app.scheduler.triggerJob('missing')).rejects.toThrow(/does not exist/);
    });
  });

  describe('removeJob safety', () => {
    it('does not throw when removing a job that is currently running, and the tick no longer sees it', async () => {
      vi.useFakeTimers();
      app = await buildApp({ tickIntervalMs: 1 });
      const handler = vi.fn().mockImplementation(() => new Promise(() => { }));
      await app.scheduler.addJob({ name: 'sync', intervalMs: 5, handler });

      await vi.advanceTimersByTimeAsync(5);
      expect(handler).toHaveBeenCalledTimes(1);

      await expect(app.scheduler.removeJob('sync')).resolves.not.toThrow();
      expect(app.scheduler.hasJob('sync')).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      expect(app.scheduler.hasJob('sync')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('restores a job\'s run count and lastRun from disk when re-added after a restart', async () => {
      // Real timers here, not fake - this exercises real fs writes/reads,
      // and fake timers don't drive the real event loop those need to
      // settle on. maxRuns: 1 keeps the run count deterministic regardless
      // of exact timing, instead of trying to count ticks precisely.
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schedule-plugin-test-'));
      try {
        const handler = vi.fn().mockResolvedValue(undefined);

        app = await buildApp({
          tickIntervalMs: 5,
          persistence: { enabled: true, directory, saveInterval: 5 },
        });
        await app.scheduler.addJob({ name: 'sync', intervalMs: 5, maxRuns: 1, handler });

        await new Promise(resolve => setTimeout(resolve, 100)); // run + save settle
        expect(app.scheduler.getJobStats('sync')!.job.runCount).toBe(1);

        await app.close();

        const app2 = await buildApp({
          tickIntervalMs: 5,
          persistence: { enabled: true, directory, saveInterval: 5 },
        });
        try {
          await app2.scheduler.addJob({ name: 'sync', intervalMs: 5, maxRuns: 1, handler });
          expect(app2.scheduler.getJobStats('sync')!.job.runCount).toBe(1);
        } finally {
          await app2.close();
        }
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    });
  });
});
