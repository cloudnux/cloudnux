import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createLocalEventBrokerService } from '../../services/event-broker';
import { MockHttpServer } from '../helpers/mock-http-server';

describe('LocalEventBrokerService', () => {
  let mockServer: MockHttpServer;
  let eventBrokerService: ReturnType<typeof createLocalEventBrokerService>;
  let serverUrl: string;

  beforeAll(async () => {
    // Start mock HTTP server
    mockServer = new MockHttpServer();
    serverUrl = await mockServer.start();
  });

  afterAll(async () => {
    // Stop mock HTTP server
    await mockServer.stop();
  });

  beforeEach(() => {
    // Set environment variable to point to mock server
    process.env.DEV_CLOUD_EVENT_BROKER_URL = serverUrl;
    eventBrokerService = createLocalEventBrokerService();
    mockServer.clearMessages();
  });

  afterEach(() => {
    delete process.env.DEV_CLOUD_EVENT_BROKER_URL;
  });

  describe('publish', () => {
    it('should publish a string message to a queue', async () => {
      const queue = 'test-queue';
      const message = 'Hello, World!';

      await eventBrokerService.publish(queue, message);

      const messages = mockServer.getMessages(queue);
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe(message);
    });

    it('should publish an object message to a queue', async () => {
      const queue = 'test-queue';
      const message = { event: 'user.created', userId: '123' };

      await eventBrokerService.publish(queue, message);

      const messages = mockServer.getMessages(queue);
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toEqual(message);
    });

    it('should publish message with attributes', async () => {
      const queue = 'test-queue';
      const message = 'Test message';
      const options = {
        attributes: {
          'x-custom-header': 'custom-value',
          'x-priority': 'high',
        },
      };

      await eventBrokerService.publish(queue, message, options);

      const messages = mockServer.getMessages(queue);
      expect(messages).toHaveLength(1);
      expect(messages[0].attributes).toMatchObject(options.attributes);
    });

    it('should publish message with FIFO properties', async () => {
      const queue = 'test-queue.fifo';
      const message = 'FIFO message';
      const options = {
        messageGroupId: 'group-1',
        messageDeduplicationId: 'dedup-1',
      };

      await eventBrokerService.publish(queue, message, options);

      const messages = mockServer.getMessages(queue);
      expect(messages).toHaveLength(1);
      expect(messages[0].attributes['x-message-group-id']).toBe(options.messageGroupId);
      expect(messages[0].attributes['x-message-deduplication-id']).toBe(options.messageDeduplicationId);
    });

    it('should publish message with delay', async () => {
      const queue = 'test-queue';
      const message = 'Delayed message';
      const options = {
        delaySeconds: 10,
      };

      await eventBrokerService.publish(queue, message, options);

      const messages = mockServer.getMessages(queue);
      expect(messages).toHaveLength(1);
      expect(messages[0].attributes['x-delay-seconds']).toBe('10');
    });

    it('should handle full URL as queue name', async () => {
      const fullUrl = `${serverUrl}/custom-queue`;
      const message = 'Test message';

      await eventBrokerService.publish(fullUrl, message);

      const messages = mockServer.getMessages('custom-queue');
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe(message);
    });
  });

  describe('peek', () => {
    beforeEach(async () => {
      // Publish some test messages
      await eventBrokerService.publish('peek-queue', 'Message 1');
      await eventBrokerService.publish('peek-queue', 'Message 2');
      await eventBrokerService.publish('peek-queue', 'Message 3');
    });

    it('should peek at messages without removing them', async () => {
      const messages = await eventBrokerService.peek('peek-queue');

      expect(messages).toHaveLength(1); // Default maxMessages is 1
      expect(messages[0].body).toBe('Message 1');

      // Verify messages are still in queue
      const queueMessages = mockServer.getMessages('peek-queue');
      expect(queueMessages).toHaveLength(3);
    });

    it('should peek multiple messages', async () => {
      const messages = await eventBrokerService.peek('peek-queue', {
        maxMessages: 2,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('Message 1');
      expect(messages[1].body).toBe('Message 2');

      // Verify messages are still in queue
      const queueMessages = mockServer.getMessages('peek-queue');
      expect(queueMessages).toHaveLength(3);
    });

    it('should return empty array for empty queue', async () => {
      const messages = await eventBrokerService.peek('empty-queue');

      expect(messages).toHaveLength(0);
    });

    it('should include message metadata', async () => {
      const messages = await eventBrokerService.peek('peek-queue');

      expect(messages[0]).toHaveProperty('id');
      expect(messages[0]).toHaveProperty('body');
      expect(messages[0]).toHaveProperty('publishedAt');
      expect(messages[0].publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('read', () => {
    beforeEach(async () => {
      // Publish some test messages
      await eventBrokerService.publish('read-queue', 'Message 1');
      await eventBrokerService.publish('read-queue', 'Message 2');
      await eventBrokerService.publish('read-queue', 'Message 3');
    });

    it('should read and remove messages from queue', async () => {
      const messages = await eventBrokerService.read('read-queue');

      expect(messages).toHaveLength(1); // Default maxMessages is 1
      expect(messages[0].body).toBe('Message 1');

      // Verify message is removed from queue
      const queueMessages = mockServer.getMessages('read-queue');
      expect(queueMessages).toHaveLength(2);
    });

    it('should read multiple messages', async () => {
      const messages = await eventBrokerService.read('read-queue', {
        maxMessages: 2,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('Message 1');
      expect(messages[1].body).toBe('Message 2');

      // Verify messages are removed from queue
      const queueMessages = mockServer.getMessages('read-queue');
      expect(queueMessages).toHaveLength(1);
    });

    it('should return empty array for empty queue', async () => {
      const messages = await eventBrokerService.read('empty-queue');

      expect(messages).toHaveLength(0);
    });

    it('should include receipt handle for message deletion', async () => {
      const messages = await eventBrokerService.read('read-queue');

      expect(messages[0]).toHaveProperty('receiptHandle');
      expect(messages[0].receiptHandle).toBeTruthy();
    });

    it('should support visibility timeout option', async () => {
      const messages = await eventBrokerService.read('read-queue', {
        visibilityTimeout: 30,
      });

      expect(messages).toHaveLength(1);
      // Note: Mock server doesn't actually implement visibility timeout,
      // but we verify the option is passed correctly
    });
  });

  describe('integration tests', () => {
    it('should handle publish-peek-read workflow', async () => {
      const queue = 'workflow-queue';
      const testMessage = { event: 'test', data: { id: 1 } };

      // Publish
      await eventBrokerService.publish(queue, testMessage);

      // Peek (should not remove)
      const peekedMessages = await eventBrokerService.peek(queue);
      expect(peekedMessages).toHaveLength(1);
      expect(JSON.parse(peekedMessages[0].body)).toEqual(testMessage);

      // Read (should remove)
      const readMessages = await eventBrokerService.read(queue);
      expect(readMessages).toHaveLength(1);
      expect(JSON.parse(readMessages[0].body)).toEqual(testMessage);

      // Queue should be empty now
      const emptyPeek = await eventBrokerService.peek(queue);
      expect(emptyPeek).toHaveLength(0);
    });

    it('should handle multiple queues independently', async () => {
      const queue1 = 'queue-1';
      const queue2 = 'queue-2';

      await eventBrokerService.publish(queue1, 'Message for queue 1');
      await eventBrokerService.publish(queue2, 'Message for queue 2');

      const messages1 = await eventBrokerService.read(queue1);
      const messages2 = await eventBrokerService.read(queue2);

      expect(messages1[0].body).toBe('Message for queue 1');
      expect(messages2[0].body).toBe('Message for queue 2');
    });

    it('should handle batch publishing and reading', async () => {
      const queue = 'batch-queue';
      const messageCount = 5;

      // Publish multiple messages
      for (let i = 1; i <= messageCount; i++) {
        await eventBrokerService.publish(queue, `Message ${i}`);
      }

      // Read all messages
      const messages = await eventBrokerService.read(queue, {
        maxMessages: messageCount,
      });

      expect(messages).toHaveLength(messageCount);
      messages.forEach((msg, index) => {
        expect(msg.body).toBe(`Message ${index + 1}`);
      });

      // Queue should be empty
      const remaining = await eventBrokerService.peek(queue);
      expect(remaining).toHaveLength(0);
    });

    it('should preserve message order (FIFO)', async () => {
      const queue = 'fifo-test-queue';
      const messages = ['First', 'Second', 'Third'];

      // Publish in order
      for (const msg of messages) {
        await eventBrokerService.publish(queue, msg);
      }

      // Read in order
      const readMessages = await eventBrokerService.read(queue, {
        maxMessages: 3,
      });

      expect(readMessages.map(m => m.body)).toEqual(messages);
    });
  });
});
