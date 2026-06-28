import Fastify, { FastifyInstance } from "fastify";
import fastifyRawBody from "fastify-raw-body";
import cors from '@fastify/cors';
import fastifyPrintRoutes from 'fastify-print-routes';

import { setWebSocketManager } from "../services/websocket";
import { setInvokeManager } from "../services/invoke";
import { logger, enterLogContext, runWithLogContext, subscribeToLogs } from "../logger";
import "../logger/types";

export type RouterInstance = FastifyInstance

// Create a reusable router function
export function createRouter(): RouterInstance {
  const fastify = Fastify({
    maxParamLength: 1000,
    logger: false
  });

  fastify.decorate('logging', { logger, runWithLogContext, subscribeToLogs });

  fastify.register(fastifyRawBody, {
    field: 'rawBody',
    encoding: 'utf8',
  });

  //TODO: get config from the nux.config
  fastify.register(cors, {
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  fastify.register(fastifyPrintRoutes);

  fastify.addHook('onRequest', (request) => {
    const module = (request.routeOptions.config as { module?: string } | undefined)?.module;
    enterLogContext({ module, reqId: request.id });
  });

  fastify.addHook('onResponse', (request, reply) => {
    logger.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, responseTime: reply.elapsedTime },
      `${request.method} ${request.url} ${reply.statusCode}`
    );
  });

  fastify.addHook('onError', (_request, _reply, error) => {
    logger.error(error);
  });

  fastify.addHook('onReady', () => {
    setWebSocketManager(fastify.websockets);
    setInvokeManager(fastify.invokes);
  });

  return fastify;
}
