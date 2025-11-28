import Fastify, { FastifyInstance } from 'fastify';

/**
 * Create a mock HTTP server for testing event broker
 */
export class MockHttpServer {
  private server: FastifyInstance;
  private messages: Map<string, any[]> = new Map();
  public port: number;

  constructor(port = 0) {
    this.port = port;
    this.server = Fastify({
      logger: false,
    });
    // Add content type parser for all types
    this.server.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
      try {
        const parsedBody = typeof body === 'string' && body ? JSON.parse(body) : body;
        done(null, parsedBody);
      } catch {
        done(null, body);
      }
    });
    this.setupRoutes();
  }

  private setupRoutes() {
    // POST - Publish message
    this.server.post('/:queue', async (request, reply) => {
      const { queue } = request.params as { queue: string };
      const body = request.body;
      const headers = request.headers;

      const message = {
        id: Math.random().toString(36).substring(7),
        body: typeof body === 'string' ? body : body,
        attributes: this.extractAttributes(headers),
        publishedAt: new Date().toISOString(),
      };

      if (!this.messages.has(queue)) {
        this.messages.set(queue, []);
      }

      this.messages.get(queue)!.push(message);
      reply.status(200).send({ messageId: message.id });
    });

    // GET - Peek messages
    this.server.get('/:queue', async (request, reply) => {
      const { queue } = request.params as { queue: string };
      const { maxMessages = '1' } = request.query as { maxMessages?: string };

      const messages = this.messages.get(queue) || [];
      const count = Math.min(parseInt(maxMessages), messages.length);
      const result = messages.slice(0, count);

      reply.status(200).send(result);
    });

    // DELETE - Read and remove messages
    this.server.delete('/:queue', async (request, reply) => {
      const { queue } = request.params as { queue: string };
      const { maxMessages = '1' } = request.query as { maxMessages?: string };

      const messages = this.messages.get(queue) || [];
      const count = Math.min(parseInt(maxMessages), messages.length);
      const result = messages.splice(0, count);

      reply.status(200).send(result);
    });
  }

  private extractAttributes(headers: any): Record<string, string> {
    const attributes: Record<string, string> = {};

    // Extract custom headers as attributes (exclude standard HTTP headers)
    Object.entries(headers).forEach(([key, value]) => {
      if (!key.startsWith(':') && !['host', 'content-length', 'content-type', 'user-agent'].includes(key.toLowerCase())) {
        attributes[key] = value as string;
      }
    });

    return attributes;
  }

  async start(): Promise<string> {
    const address = await this.server.listen({ port: this.port, host: '127.0.0.1' });
    this.port = this.server.server.address()?.['port'] || this.port;
    return address;
  }

  async stop(): Promise<void> {
    await this.server.close();
  }

  getMessages(queue: string): any[] {
    return this.messages.get(queue) || [];
  }

  clearMessages(queue?: string): void {
    if (queue) {
      this.messages.delete(queue);
    } else {
      this.messages.clear();
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }
}
