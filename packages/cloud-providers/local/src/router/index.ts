import Fastify, { FastifyInstance } from "fastify";

export type RouterInstance = FastifyInstance

// Create a reusable router function
export function createRouter(options: { logger?: boolean } = {}): RouterInstance {
  const fastify = Fastify({
    maxParamLength: 1000,
    logger: options.logger ,
  });
  return fastify;
}
