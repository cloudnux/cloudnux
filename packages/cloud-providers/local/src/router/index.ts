import Fastify, { FastifyInstance } from "fastify";
import fastifyRawBody from "fastify-raw-body";
import cors from '@fastify/cors';
import fastifyPrintRoutes from 'fastify-print-routes';

import { setWebSocketManager } from "../services/websocket";
import { setInvokeManager } from "../services/invoke";

export type RouterInstance = FastifyInstance

// Create a reusable router function
export function createRouter(options: { logger?: boolean } = {}): RouterInstance {
  const fastify = Fastify({
    maxParamLength: 1000,
    ...(options.logger ? { logger: true } : {}),
  });

  fastify.register(fastifyRawBody, {
    field: 'rawBody',
    encoding: 'utf8',
  });

  //TODO: get config from the nux.config
  fastify.register(cors, {
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  fastify.register(fastifyPrintRoutes);

  fastify.addHook('onReady', () => {
    setWebSocketManager(fastify.websockets);
    setInvokeManager(fastify.invokes);
  });

  return fastify;
}
