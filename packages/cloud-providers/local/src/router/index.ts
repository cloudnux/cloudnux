import Fastify, { FastifyInstance } from "fastify";
import  fastifyRawBody from "fastify-raw-body";

export type RouterInstance = FastifyInstance

// Create a reusable router function
export function createRouter(options: { logger?: boolean } = {}): RouterInstance {
  const fastify = Fastify({
    maxParamLength: 1000,
    logger: options.logger ,
  });

  fastify.register(fastifyRawBody, {
    field: 'rawBody',
    encoding: 'utf8',
  });

  return fastify;
}
