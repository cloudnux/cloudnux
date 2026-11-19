import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createLoggerService,
    enterLogContext,
    getLogContext,
    resetLogLevel,
    runWithLogContext,
} from '../../services/logger';

let lines: string[];
let spy: ReturnType<typeof vi.spyOn>;

function entries() {
    return lines.map(line => JSON.parse(line));
}

beforeEach(() => {
    lines = [];
    spy = vi.spyOn(console, 'log').mockImplementation((line: string) => {
        lines.push(line);
    });
    delete process.env.LOG_LEVEL;
    resetLogLevel();
});

afterEach(() => {
    spy.mockRestore();
    delete process.env.LOG_LEVEL;
    resetLogLevel();
});

describe('azure logger', () => {
    it('writes one JSON line in the LogEntry shape', () => {
        createLoggerService().info({ orderId: 42 }, 'order placed');
        expect(entries()).toEqual([{
            level: 3,
            levelName: 'info',
            time: expect.any(Number),
            module: 'default',
            reqId: '',
            msg: 'order placed',
            meta: { orderId: 42 },
        }]);
    });

    it('accepts a plain string and an Error', () => {
        const logger = createLoggerService();
        logger.warn('just text');
        logger.error(new Error('boom'));
        const [text, error] = entries();
        expect(text).toMatchObject({ levelName: 'warn', msg: 'just text' });
        expect(text.meta).toBeUndefined();
        expect(error.msg).toMatch(/^Error: boom/);
    });

    it('respects LOG_LEVEL, read on first write', () => {
        process.env.LOG_LEVEL = 'warn';
        const logger = createLoggerService();
        logger.info('hidden');
        logger.debug('hidden');
        logger.warn('shown');
        logger.fatal('shown');
        expect(entries().map(e => e.levelName)).toEqual(['warn', 'fatal']);
        expect(logger.level).toBe('warn');
    });

    it('falls back to info for an unknown LOG_LEVEL', () => {
        process.env.LOG_LEVEL = 'chatty';
        expect(createLoggerService().level).toBe('info');
    });

    it('lets an explicit module/reqId in the merge object win', () => {
        runWithLogContext({ module: 'orders', reqId: 'r1' }, () => {
            createLoggerService().info({ module: 'billing', reqId: 'r9', x: 1 }, 'm');
        });
        expect(entries()[0]).toMatchObject({ module: 'billing', reqId: 'r9', meta: { x: 1 } });
    });

    it('survives circular meta and serializes nested errors', () => {
        const meta: Record<string, unknown> = { name: 'loop' };
        meta.self = meta;
        createLoggerService().error({ meta, cause: new Error('inner') }, 'bad');
        const [entry] = entries();
        expect(entry.meta.meta.self).toBe('[Circular]');
        expect(entry.meta.cause).toMatchObject({ name: 'Error', message: 'inner' });
    });
});

describe('log context isolation (concurrent invocations)', () => {
    it('keeps reqId per invocation across awaits', async () => {
        const logger = createLoggerService();
        const tick = () => new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        await Promise.all(['a', 'b', 'c', 'd'].map(id =>
            runWithLogContext({ module: 'orders', reqId: id }, async () => {
                for (let i = 0; i < 3; i++) {
                    await tick();
                    logger.info({ step: i }, `req ${id}`);
                }
            })
        ));

        for (const entry of entries()) {
            expect(entry.msg).toBe(`req ${entry.reqId}`);
        }
        expect(entries()).toHaveLength(12);
    });

    it('setBindings inside an invocation only affects that invocation', async () => {
        const logger = createLoggerService();
        await Promise.all([
            runWithLogContext({ reqId: 'one' }, async () => {
                logger.setBindings({ module: 'm-one' });
                await new Promise(resolve => setTimeout(resolve, 5));
                logger.info('from one');
            }),
            runWithLogContext({ reqId: 'two' }, async () => {
                logger.setBindings({ module: 'm-two' });
                logger.info('from two');
            }),
        ]);
        const byReq = Object.fromEntries(entries().map(e => [e.reqId, e.module]));
        expect(byReq).toEqual({ one: 'm-one', two: 'm-two' });
    });

    it('runWithLogContext copies the context, so the caller object is untouched', () => {
        const context = { reqId: 'r' };
        runWithLogContext(context, () => createLoggerService().setBindings({ module: 'x' }));
        expect(context).toEqual({ reqId: 'r' });
    });

    it('setBindings outside an invocation sets process defaults', async () => {
        const logger = createLoggerService();
        await new Promise<void>(resolve => setImmediate(() => {
            logger.setBindings({ module: 'worker' });
            resolve();
        }));
        logger.info('startup');
        runWithLogContext({ reqId: 'r1' }, () => logger.info('in request'));
        expect(entries().map(e => e.module)).toEqual(['worker', 'worker']);
        expect(entries()[1].reqId).toBe('r1');
        // reset process defaults for other tests
        logger.setBindings({ module: '' });
    });

    it('enterLogContext binds the rest of the async chain', async () => {
        await new Promise<void>(resolve => setImmediate(async () => {
            enterLogContext({ reqId: 'entered' });
            await Promise.resolve();
            expect(getLogContext().reqId).toBe('entered');
            resolve();
        }));
    });
});

describe('invocation context routing', () => {
    function fakeInvocation() {
        return {
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
    }

    it('writes through the invocation context with the matching severity', () => {
        process.env.LOG_LEVEL = 'trace';
        const invocation = fakeInvocation();
        const logger = createLoggerService();

        runWithLogContext({ module: 'orders', reqId: 'inv-1', invocation }, () => {
            logger.fatal('f');
            logger.error('e');
            logger.warn('w');
            logger.info('i');
            logger.debug('d');
            logger.trace('t');
        });

        expect(invocation.error).toHaveBeenCalledTimes(2); // fatal + error
        expect(invocation.warn).toHaveBeenCalledTimes(1);
        expect(invocation.info).toHaveBeenCalledTimes(1);
        expect(invocation.debug).toHaveBeenCalledTimes(1);
        expect(invocation.trace).toHaveBeenCalledTimes(1);
        expect(lines).toEqual([]); // nothing went to stdout

        const fatal = JSON.parse(invocation.error.mock.calls[0][0]);
        expect(fatal).toMatchObject({ levelName: 'fatal', module: 'orders', reqId: 'inv-1', msg: 'f' });
    });

    it('does not serialize the invocation context into the entry', () => {
        const invocation = fakeInvocation();
        runWithLogContext({ reqId: 'r', invocation }, () => createLoggerService().info({ a: 1 }, 'x'));
        const entry = JSON.parse(invocation.info.mock.calls[0][0]);
        expect(Object.keys(entry)).toEqual(['level', 'levelName', 'time', 'module', 'reqId', 'msg', 'meta']);
        expect(entry.meta).toEqual({ a: 1 });
    });

    it('keeps each concurrent invocation on its own context', async () => {
        const a = fakeInvocation();
        const b = fakeInvocation();
        const logger = createLoggerService();
        await Promise.all([
            runWithLogContext({ reqId: 'a', invocation: a }, async () => {
                await new Promise(resolve => setTimeout(resolve, 5));
                logger.info('from a');
            }),
            runWithLogContext({ reqId: 'b', invocation: b }, async () => {
                logger.info('from b');
            }),
        ]);
        expect(JSON.parse(a.info.mock.calls[0][0]).msg).toBe('from a');
        expect(JSON.parse(b.info.mock.calls[0][0]).msg).toBe('from b');
        expect(a.info).toHaveBeenCalledTimes(1);
        expect(b.info).toHaveBeenCalledTimes(1);
    });

    it('falls back to stdout if the invocation context throws', () => {
        const invocation = fakeInvocation();
        invocation.info.mockImplementation(() => { throw new Error('invocation finished'); });
        runWithLogContext({ reqId: 'r', invocation }, () => createLoggerService().info('late'));
        expect(entries()).toEqual([expect.objectContaining({ msg: 'late', reqId: 'r' })]);
    });

    it('setBindings cannot replace the invocation', () => {
        const invocation = fakeInvocation();
        const logger = createLoggerService();
        runWithLogContext({ reqId: 'r', invocation }, () => {
            logger.setBindings({ module: 'm', invocation: 'oops' } as Record<string, string>);
            logger.info('x');
        });
        expect(invocation.info).toHaveBeenCalledTimes(1);
        expect(JSON.parse(invocation.info.mock.calls[0][0]).module).toBe('m');
    });

    it('accepts a real InvocationContext shape (type check)', () => {
        // InvocationContext from @azure/functions has trace/debug/info/warn/error(...args: any[]).
        type InvocationContextLike = { invocationId: string; functionName: string; log(...a: any[]): void } & ReturnType<typeof fakeInvocation>;
        const ctx: InvocationContextLike = { invocationId: 'id', functionName: 'fn', log: vi.fn(), ...fakeInvocation() };
        runWithLogContext({ reqId: ctx.invocationId, invocation: ctx }, () => createLoggerService().warn('typed'));
        expect(ctx.warn).toHaveBeenCalledTimes(1);
    });
});
