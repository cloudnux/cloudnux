import {
  FunctionContext,
  HandlerType,
  Adapter,
  Matcher,
} from "@@types";

export interface Handler {
  matcher: Matcher;
  createContext: (adapter: Adapter, ...args: any[]) => FunctionContext;
  func: (context: FunctionContext) => void | Promise<void>;
}

export const createRouter = () => {
  const _handlers: Handler[] = [];

  const add = (handler: Handler) => {
    _handlers.push(handler);
  };

  const run = async (handlerType: HandlerType, adapter?: Adapter, ...args: any[]) => {
    let i = 0;
    const matchedHandler = _handlers.find((handler) => {
      return handler.matcher(handlerType, ...args);
    });

    if (!matchedHandler) {
      throw new Error(`No handler found for handler type: ${handlerType}`);
    }

    const context = matchedHandler.createContext(adapter, ...args);
    try {
      await matchedHandler.func(context);
    } catch (error) {
      await context.error();
    }

    return context.output();
  };

  return {
    add,
    run,
  };
};