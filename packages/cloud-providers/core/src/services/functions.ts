import { HandlerType, HttpMethod } from "../entrypoint";

/**
 * Represents the context object for a function handler.
 */
export type FunctionContext = {
    /**
     * The underlying context handler type.
     */
    type: HandlerType;

    /**
     * Creates a success response. This should be called when the handler is done successfully.
     * @param data - The response body.
     */
    success<T>(data: T): void;

    /**
     * Creates an error response. This should be called when the handler is done with an error.
     * @param message - The response body.
     * 
     */
    error(message: string, code?: ErrorCode, details?: Record<string, any>, stack?: string): void;
    notFound(resource: string, id?: string | number): void;



    // success(body?: any): void;


    // error(body?: any): void;

    // /**
    //  * Creates a not found response. This should be called when there is no matching handler.
    //  * @param body - The response body.
    //  * @returns A promise that resolves when the response is created, or void if not using a promise.
    //  */
    // notFound(body?: any): void;
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
    host?: string
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
    created<T>(data: T): void;
    deleted(id?: string | number): void;
    validationError(details: Record<string, any>): void;
    serverError(err: Error): void;
    businessError(message: string, details?: Record<string, any>): void;
    output(status: number, body?: string, headers?: Record<string, string | string[]>): void;
}

//#endregion

//#region [Schedule]

export type ScheduleResponse = {
    status: number;
    body?: string | Record<string, any>;
}

export type ScheduleRequest = {
    name: string,
    requestId?: string
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
}

export type EventResponse = {
    status: "success" | "error",
    code?: ErrorCode,
    body?: Record<string, any>
    stack?: string
};

export type EventFunctionContext = FunctionContext & {
    type: "Event";
    timestamp: Date;
    attempts?: number;
    response: EventResponse;
    message<T = Record<string, any>>(): T;
    attributes<T = Record<string, any>>(): T;
}
//#endregion

export interface FunctionsService {
    createHttRequest(...args: any[]): [HTTPRequest, HTTPAuth?];
    createScheduleRequest(...args: any[]): [ScheduleRequest];
    createEventRequest(...args: any[]): [EventRequest];

    buildHttpResponse(httpFunctionContext: HttpFunctionContext, ...args: any[]): any
    buildScheduleResponse(scheduleFunctionContext: ScheduleFunctionContext, ...args: any[]): any;
    buildEventResponse(eventFunctionContext: EventFunctionContext, ...args: any[]): any;
}