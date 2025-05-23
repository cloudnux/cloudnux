export type HandlerType = "Http" | "Schedule";

export type HttpMethod = "GET" | "PUT" | "POST" | "PATCH" | "DELETE";

export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}

export type HttpTrigger = {
  type: "http"
  options: {
    route: string,
    method: HttpMethod,
    auth?: {
      audience?: string,
      scope?: string
    } | boolean
  }
}

export type ScheduleTrigger = {
  type: "schedule",
  options: {
    pattern: string
  }
}

//#region [for future]

// export type EventTrigger = {
//   type: "event"
// }

// export type FileTrigger = {
//   type: "file"
// }

//#endregion

export type BaseEntry<TTrigger> = {
  handler: string,
  trigger: TTrigger
}

export type HttpEntry = BaseEntry<HttpTrigger>;
export type ScheduleEntry = BaseEntry<ScheduleTrigger>

export type Entry =
  HttpEntry
  | ScheduleEntry
//| BaseEntry<FileTrigger>
//| BaseEntry<EventTrigger>

export type Entrypoint = {
  entries: Record<string, Entry>
}

//#region [ HTTP ]

export type HTTPRequest = {
  method: HttpMethod;
  body?: string;
  headers: Record<string, string | string[] | undefined>;
  url: string;
  params: Record<string, string>
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

//#endregion

//#region [ Schedule ]
export type ScheduleRequest = {
  name: string,
  requestId?: string
};
//#endregion

//#region [context]
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
   * @param body - The response body.
   * @returns A promise that resolves when the response is created, or void if not using a promise.
   */
  success(body?: any): Promise<void> | void;

  /**
   * Creates an error response. This should be called when the handler is done with an error.
   * @param body - The response body.
   * @returns A promise that resolves when the response is created, or void if not using a promise.
   */
  error(body?: any): Promise<void> | void;

  /**
   * Creates a not found response. This should be called when there is no matching handler.
   * @param body - The response body.
   * @returns A promise that resolves when the response is created, or void if not using a promise.
   */
  notFound(body?: any): Promise<void> | void;

  /**
   * Creates an accepted response. This should be called when the request is accepted but not yet processed.
   * @param body - The response body.
   * @returns A promise that resolves when the response is created, or void if not using a promise.
   */
  output(): { status: number; body?: any };

};

/**
 * Represents the context object for an HTTP function.
 */
export type HttpFunctionContext = FunctionContext & {
  type: "Http";

  request: HTTPRequest;
  response: HTTPResponse;
  auth?: HTTPAuth;

  /**
   * Retrieves the request body as a strongly-typed model.
   * @returns The request body as a strongly-typed model.
   */
  model<T = Record<string, any>>(): T;

  /**
   * Retrieves the request url parameters as a strongly-typed object.
   * @returns The request url parameters as a strongly-typed object.
   */
  params<T = Record<string, string>>(): T;

  /**
   * Sends an HTTP response with the specified status, body, and headers.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  output(): HTTPResponse;

  /**
   * Sends a success HTTP 200 response with an optional body.
   * @param body - The response body.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  success(body?: any): Promise<void> | void;

  /**
   * Sends an HTTP 202 Accepted response with an optional body.
   * @param body - The response body.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  accepted(body?: any): Promise<void> | void;

  /**
   * Sends an HTTP 400 Bad Request response with an optional body.
   * @param body - The response body.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  failed(body?: any): Promise<void> | void;

  /**
   * Sends an HTTP 500 Internal Server Error response with an optional body.
   * @param body - The response body.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  error(body?: any): Promise<void> | void;

  /**
   * Sends an HTTP 404 Not Found response with an optional body.
   * @param body - The response body.
   * @returns A promise that resolves when the response is sent, or void if no promise is returned.
   */
  notFound(body?: any): Promise<void> | void;

  /**
  * Sends an HTTP response with the specified status and body.
   * @param status - The HTTP status code.
   * @param body - The response body.
   * @returns The HTTP response object.
   * */
  output(): HTTPResponse;
};

export type ScheduleFunctionContext = FunctionContext & {
  request: ScheduleRequest;
  type: "Schedule";

  output(): { status: number; body: any };

  success(body?: any): void;
  error(body?: any): void;
  notFound(body?: any): void;
};

//#endregion


//#region [ router ]

export type Adapter = {
  input: (...args: any[]) => any;
  output: (output: HTTPResponse) => any;
};

export type Matcher = (handlerType: HandlerType, ...args: any[]) => boolean;

//#endregion

//#region [ pipes ]
export type Pipe = (context: FunctionContext) => void | Promise<void>;
//#endregion
