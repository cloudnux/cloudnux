/**
 * Thrown by a compose enhancer to stop the handler chain after it has
 * already written a response onto the context (e.g. `ctx.unauthorized()`).
 * `httpHandler` catches this and builds the response instead of rethrowing.
 */
export class HttpHalt extends Error {}
