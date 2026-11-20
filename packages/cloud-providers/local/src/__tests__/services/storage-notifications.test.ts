import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBrokerService, registerService } from '@cloudnux/core-cloud-provider';

import {
  addNotificationRule,
  deleteNotificationRule,
  listNotificationRules,
  matchNotificationRules,
  NOTIFICATION_RULES_FILE,
  OBJECT_CREATED_MESSAGE_TYPE,
  validateRule,
} from '../../services/storage-notifications';
import { createLocalStorageService, listStorageBuckets, listStorageObjects } from '../../services/storage';
import { createTempDir, cleanupDir } from '../helpers/test-utils';

const published: { target: string; message: any }[] = [];
let failPublish = false;

registerService('event-broker', () => ({
  async publish(target: string, message: any) {
    if (failPublish) throw new Error('broker down');
    published.push({ target, message });
  },
}) as unknown as EventBrokerService);

const rule = { id: 'uploads', bucket: 'invoices', prefix: 'uploads/', events: ['created'], queue: 'invoice-processing' };

describe('storage notification rules', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.env.DEV_CLOUD_STORAGE_BUCKET = tempDir;
    published.length = 0;
    failPublish = false;
  });

  afterEach(() => {
    cleanupDir(tempDir);
    delete process.env.DEV_CLOUD_STORAGE_BUCKET;
  });

  describe('validateRule', () => {
    it('accepts a queue rule and drops empty filters', () => {
      expect(validateRule({ ...rule, suffix: '' })).toEqual(rule);
    });

    it('requires exactly one target', () => {
      expect(() => validateRule({ ...rule, queue: undefined })).toThrow(/exactly one target/);
      expect(() => validateRule({ ...rule, topic: 'events' })).toThrow(/exactly one target/);
    });

    it('rejects unknown events, bad ids and bad buckets', () => {
      expect(() => validateRule({ ...rule, events: ['deleted'] })).toThrow(/events/);
      expect(() => validateRule({ ...rule, id: 'has space' })).toThrow(/id/);
      expect(() => validateRule({ ...rule, bucket: '../x' })).toThrow(/bucket/i);
    });
  });

  it('stores rules in the storage folder as a metadata file, invisible to buckets and objects', async () => {
    await addNotificationRule(rule);

    expect(fs.existsSync(path.join(tempDir, NOTIFICATION_RULES_FILE))).toBe(true);
    expect(NOTIFICATION_RULES_FILE.endsWith('.metadata.json')).toBe(true);
    expect(await listStorageBuckets()).toEqual([]);
    expect(await listNotificationRules()).toEqual([rule]);
  });

  it('rejects a duplicate id and deletes by id', async () => {
    await addNotificationRule(rule);
    await expect(addNotificationRule(rule)).rejects.toThrow(/already exists/);

    expect(await deleteNotificationRule('uploads')).toBe(true);
    expect(await deleteNotificationRule('uploads')).toBe(false);
    expect(await listNotificationRules()).toEqual([]);
  });

  it('generates a readable, unique id when none is given', async () => {
    const first = await addNotificationRule({ bucket: 'invoices', prefix: 'uploads/', events: ['created'], queue: 'invoice-processing' });
    const second = await addNotificationRule({ bucket: 'invoices', prefix: 'pdf/', events: ['created'], queue: 'invoice-processing' });
    const topic = await addNotificationRule({ bucket: 'invoices', events: ['created'], topic: 'invoice events' });

    expect(first.id).toBe('invoices-invoice-processing');
    expect(second.id).toBe('invoices-invoice-processing-2');
    expect(topic.id).toBe('invoices-invoice-events');
  });

  it('matches on bucket, prefix and suffix', () => {
    const rules = [validateRule(rule), validateRule({ ...rule, id: 'pdf', prefix: undefined, suffix: '.pdf' })];
    expect(matchNotificationRules(rules, 'invoices', 'uploads/a.jpg', 'created').map(r => r.id)).toEqual(['uploads']);
    expect(matchNotificationRules(rules, 'invoices', 'uploads/a.pdf', 'created').map(r => r.id)).toEqual(['uploads', 'pdf']);
    expect(matchNotificationRules(rules, 'other', 'uploads/a.pdf', 'created')).toEqual([]);
  });

  it('notifies the queue when storage.write() creates a matching object', async () => {
    await addNotificationRule(rule);
    const storage = createLocalStorageService();

    await storage.write('uploads/inv 1.jpg', 'abc', 'invoices', { contentType: 'image/jpeg' });
    await storage.write('thumbnails/inv 1.jpg', 'abc', 'invoices');

    expect(published).toHaveLength(1);
    expect(published[0].target).toBe('invoice-processing');
    expect(published[0].message).toMatchObject({
      type: OBJECT_CREATED_MESSAGE_TYPE,
      bucket: 'invoices',
      key: 'uploads/inv 1.jpg',
      size: 3,
      contentType: 'image/jpeg',
    });

    // the message reads back through the storage service, like in the cloud
    expect(storage.parseObjectCreated(JSON.stringify(published[0].message))).toMatchObject({
      bucket: 'invoices',
      key: 'uploads/inv 1.jpg',
      size: 3,
    });
  });

  it('publishes to a topic with the topic: prefix', async () => {
    await addNotificationRule({ ...rule, queue: undefined, topic: 'invoice-events' });
    await createLocalStorageService().write('uploads/x.pdf', 'x', 'invoices');
    expect(published[0].target).toBe('topic:invoice-events');
  });

  it('never fails the write when delivery fails', async () => {
    await addNotificationRule(rule);
    failPublish = true;
    const storage = createLocalStorageService();

    await expect(storage.write('uploads/x.pdf', 'x', 'invoices')).resolves.toMatchObject({ key: 'uploads/x.pdf' });
    expect((await listStorageObjects('invoices'))!.map(o => o.key)).toEqual(['uploads/x.pdf']);
  });

  it('parseObjectCreated ignores other messages', () => {
    const storage = createLocalStorageService();
    expect(storage.parseObjectCreated({ hello: 'world' })).toBeNull();
    expect(storage.parseObjectCreated('not json')).toBeNull();
  });
});
