import { HandlerType, HttpMethod, WebSocketEvent } from "../entrypoint";
import { LoggerService } from "./logger";

/**
 * Represents the context object for a function handler.
 */
export type FunctionContext = {
    /**
     * The underlying context handler type.
     */
    type: HandlerType;

    /**
     * Logger bound to this invocation's module name and request id.
     */
    logger: LoggerService;

    /**
     * Creates a success response. This should be called when the handler is done successfully.
     * @param data - The response body.
     */
    success<T>(data: T): void;

    /**
     * Creates a server error response. This should be called when the handler encounters an unexpected error.
     * @param err - The error object.
     */
    serverError(err: Error): void;
    /**
     * Creates an error response. This should be called when the handler is done with an error.
     * @param message - The response body.
     * 
     */
    error(message: string, code?: ErrorCode, details?: Record<string, any>, stack?: string): void;
    /**
     * Creates a not found response. This should be called when the requested resource is not found.
     * @param resource - The name of the resource that was not found.
     * @param id - The id of the resource that was not found (optional).
     */
    notFound(resource: string, id?: string | number): void;
};

/**
 * Error codes for API error responses
 */
export enum ErrorCode {
    // Validation errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_INPUT = 'INVALID_INPUT',

    // Authentication errors
    UNAUTHORIZED = 'UNAUTHORIZED',
    ACCESS_DENIED = 'ACCESS_DENIED',

    // Resource errors
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
    RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

    // System errors
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    DATABASE_ERROR = 'DATABASE_ERROR',

    // Business logic errors
    BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',

    // External API errors
    EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',

    // Other errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

//#region [ Http ]

export type HTTPRequest = {
    method: HttpMethod;
    body?: string;
    headers: Record<string, string | string[] | undefined>;
    url: string;
    params: Record<string, string | undefined>
    matchingKey?: string;
    rawQueryString?: string,
    requestId?: string,
    host?: string,
    moduleName?: string,
};

export type HTTPResponse = {
    headers?: Record<string, string | string[] | undefined>;
    body?: string;
    status: number;
};

export type HTTPAuth = {
    token: string;
    appId: string;
    memberId: string;
    customerId: string;
    claims: Record<string, string>;
    identity: "facebook" | "google" | "apple" | "password";
};

export type HttpFunctionContext = FunctionContext & {
    type: "Http";
    request: HTTPRequest;
    auth?: HTTPAuth;
    response: HTTPResponse;
    model<T = Record<string, any>>(): T;
    params<T = Record<string, string>>(): T;

    list<T>(items: T[], page: number, pageSize: number, totalItems: number): void;
    cursorList<T>(items: T[], nextCursor: string | null, pageSize: number, prevCursor?: string | null): void;
    created<T>(data: T): void;
    deleted(id?: string | number): void;
    validationError(details: Record<string, any>): void;
    serverError(err: Error): void;
    businessError(message: string, details?: Record<string, any>): void;

    unauthorized(message?: string): void;
    forbidden(message?: string): void;
    output(status: number, body?: string | object, headers?: Record<string, string | string[]>): void;
}

//#endregion

//#region [Schedule]

export type ScheduleResponse = {
    status: "success" | "error",
    body?: string | Record<string, any>;
}

export type ScheduleRequest = {
    name: string,
    requestId?: string,
    moduleName?: string,
};

export type ScheduleFunctionContext = FunctionContext & {
    response: ScheduleResponse;
    request: ScheduleRequest;
    type: "Schedule";
}
//#endregion

//#region [Event]
export type EventRequest = {
    body: string | Record<string, any>,
    attributes: Record<string, string>,
    requestId?: string,
    timestamp: Date,
    attempts?: number;
    moduleName?: string,
}

export type EventResponse = {
    status: "success" | "error",
    code?: ErrorCode,
    body?: Record<string, any>
    stack?: string,
    retryDelay?: number,
};

export type EventFunctionContext = FunctionContext & {
    type: "Event";
    timestamp: Date;
    attempts?: number;
    request: EventRequest;
    response: EventResponse;
    message<T = Record<string, any>>(): T;
    attributes<T = Record<string, any>>(): T;
    retryWithDelay(seconds: number): void;
}

export type EventBatchItemResult = { failureId: string } | undefined;
//#endregion

//#region [Invoke]
export type InvokeRequest = {
    payload: any,
    calledModule: string,
    invokeTriggerName: string,
    requestId?: string,
}

export type InvokeResponse = {
    status: "success" | "error",
    body?: any,
    code?: ErrorCode,
}

export type InvokeFunctionContext = FunctionContext & {
    type: "Invoke";
    request: InvokeRequest;
    response: InvokeResponse;
    payload<T = Record<string, any>>(): T;
}
//#endregion

//#region [WebSocket]
export type WebSocketRequest = {
    connectionId: string,
    event: WebSocketEvent,
    route?: string,
    url?: string,
    params: Record<string, string | undefined> | null,
    body?: string | Record<string, any> | null,
    headers?: Record<string, string | string[] | undefined>,
    queryString: Record<string, string | undefined> | null,
    requestId?: string,
    moduleName?: string,
}

export type WebSocketResponse = {
    status: "success" | "error",
    statusCode?: number,
    body?: any,
}

export type WebSocketFunctionContext = FunctionContext & {
    type: "WebSocket";
    connectionId: string;
    event: WebSocketEvent;
    request: WebSocketRequest;
    response: WebSocketResponse;
    message<T = Record<string, any>>(): T;
    params<T = Record<string, string>>(): T;
    unauthorized(body?: any): void;
    forbidden(body?: any): void;
    validationError(details: Record<string, any>): void;
}
//#endregion

export interface FunctionsService {
    createHttRequest(...args: any[]): [HTTPRequest, HTTPAuth?];
    createScheduleRequest(...args: any[]): [ScheduleRequest];
    createEventRequest(...args: any[]): [EventRequest];
    createWebSocketRequest(...args: any[]): [WebSocketRequest];
    createInvokeRequest(...args: any[]): [InvokeRequest];

    buildHttpResponse(httpFunctionContext: HttpFunctionContext, ...args: any[]): any
    buildScheduleResponse(scheduleFunctionContext: ScheduleFunctionContext, ...args: any[]): any;
    buildEventResponse(eventFunctionContext: EventFunctionContext, ...args: any[]): Promise<EventBatchItemResult>;
    buildWebSocketResponse(webSocketFunctionContext: WebSocketFunctionContext, ...args: any[]): any;
    buildInvokeResponse(invokeFunctionContext: InvokeFunctionContext, ...args: any[]): any;
}