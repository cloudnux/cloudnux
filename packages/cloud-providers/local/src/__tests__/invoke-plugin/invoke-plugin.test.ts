import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { parseInvokeTarget, InvokeError } from '@cloudnux/core-cloud-provider';

import { invokesPlugin } from '../../invoke-plugin';
import { createLocalInvokeService, configureLocalInvoke, setInvokeManager } from '../../services/invoke';

describe('invoke-plugin', () => {
  let billing: FastifyInstance;
  let billingUrl: string;
  let orders: FastifyInstance;

  beforeEach(async () => {
    // "billing" namespace dev server, really listening so the caller can reach it over http
    billing = Fastify();
    await billing.register(invokesPlugin);
    // registered handlers return the full InvokeResponse, as the generated entrypoint does
    billing.invokes.register('invoices', 'create', async ({ payload }) => ({ status: 'success', body: { created: payload.id } }));
    billing.invokes.register('invoices', 'fail', async () => { throw new Error('boom'); });
    billing.invokes.register('invoices', 'refuse', async () => ({
      status: 'error', body: 'invoice is locked', code: 'invoice_locked', details: { invoiceId: 7 },
    }));
    billingUrl = await billing.listen({ port: 0, host: '127.0.0.1' });

    // "orders" namespace, the caller
    orders = Fastify();
    await orders.register(invokesPlugin);
    orders.invokes.register('checkout', 'ping', async ({ payload }) => ({ status: 'success', body: { pong: payload } }));
    await orders.ready();
    setInvokeManager(orders.invokes);
    configureLocalInvoke({ namespace: 'orders', namespaces: { billing: billingUrl } });
  });

  afterEach(async () => {
    await billing.close();
    await orders.close();
    configureLocalInvoke({});
  });

  it('parses module and namespace/module targets', () => {
    expect(parseInvokeTarget('checkout')).toEqual({ module: 'checkout' });
    expect(parseInvokeTarget('billing/invoices')).toEqual({ namespace: 'billing', module: 'invoices' });
    expect(() => parseInvokeTarget('a/b/c')).toThrow();
    expect(() => parseInvokeTarget('/b')).toThrow();
  });

  it('serves POST /__invoke/:module/:trigger', async () => {
    const res = await billing.inject({ method: 'POST', url: '/__invoke/invoices/create', payload: { payload: { id: 7 } } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: { status: 'success', body: { created: 7 } } });
  });

  it('returns 404 for an unknown handler and 500 when the handler throws', async () => {
    const missing = await billing.inject({ method: 'POST', url: '/__invoke/invoices/nope', payload: {} });
    expect(missing.statusCode).toBe(404);
    const failed = await billing.inject({ method: 'POST', url: '/__invoke/invoices/fail', payload: {} });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({ error: 'boom' });
  });

  it('invokes a module of its own namespace in-process, with or without the namespace', async () => {
    const svc = createLocalInvokeService();
    expect(await svc.invoke('checkout', 'ping', 1)).toEqual({ pong: 1 });
    expect(await svc.invoke('orders/checkout', 'ping', 2)).toEqual({ pong: 2 });
  });

  it('invokes another namespace over http', async () => {
    const svc = createLocalInvokeService();
    expect(await svc.invoke('billing/invoices', 'create', { id: 42 })).toEqual({ created: 42 });
  });

  it('surfaces remote errors and unconfigured namespaces', async () => {
    const svc = createLocalInvokeService();
    await expect(svc.invoke('billing/invoices', 'fail', {})).rejects.toThrow('boom');
    await expect(svc.invoke('shipping/parcels', 'create', {})).rejects.toThrow('Namespace "shipping" has no url');
  });

  it('turns an error response into an InvokeError with code and details', async () => {
    const svc = createLocalInvokeService();
    const error = await svc.invoke('billing/invoices', 'refuse', {}).catch((e) => e);
    expect(error).toBeInstanceOf(InvokeError);
    expect(error).toMatchObject({
      message: 'invoice is locked', code: 'invoice_locked', details: { invoiceId: 7 },
      target: 'billing/invoices', triggerName: 'refuse',
    });
    expect(billing.invokes.getHistory('invoices', 'refuse')[0]).toMatchObject({ status: 'failed', error: 'invoice is locked' });
  });

  it('records every call in the history, most recent first', async () => {
    const svc = createLocalInvokeService();
    await svc.invoke('billing/invoices', 'create', { id: 1 });
    await expect(svc.invoke('billing/invoices', 'fail', {})).rejects.toThrow();
    await svc.invoke('billing/invoices', 'create', { id: 2 });

    const created = billing.invokes.getHistory('invoices', 'create');
    expect(created.map(e => e.payload)).toEqual([{ id: 2 }, { id: 1 }]);
    expect(created[0]).toMatchObject({ module: 'invoices', name: 'create', status: 'completed', result: { status: 'success', body: { created: 2 } } });

    const failed = billing.invokes.getHistory('invoices', 'fail');
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ status: 'failed', error: 'boom' });
    expect(failed[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('lists the registered triggers, optionally of one module', () => {
    expect(billing.invokes.entries()).toEqual([
      { module: 'invoices', name: 'create' },
      { module: 'invoices', name: 'fail' },
    ]);
    expect(billing.invokes.entries('other')).toEqual([]);
  });
});
