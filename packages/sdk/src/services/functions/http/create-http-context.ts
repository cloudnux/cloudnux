import querystring from "node:querystring";
import {
  HttpFunctionContext,
  HTTPAuth,
  HTTPRequest,
  HTTPResponse,
} from "@cloudnux/core-cloud-provider";

import {
  HttpStatus,
  ApiContentResponse,
  ApiDeleteResponse,
  ApiError,
  ApiListResponse,
  ErrorCode,
} from "./types";

export function createHttpContext(
  request: HTTPRequest,
  auth?: HTTPAuth
): HttpFunctionContext {
  const response: HTTPResponse = {
    body: undefined,
    headers: {},
    status: HttpStatus.OK
  };
  const output = (status: number, body?: string, headers?: any) => {
    response.status = status;
    response.headers = {
      ...response.headers,
      ...headers
    };
    response.body = body;
  };
  const error = (
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    message: string = 'An unexpected error occurred',
    details?: Record<string, any>,
    stack?: string
  ) => {
    const error: ApiError = {
      code,
      message,
      details
    };

    // Only include stack trace in development
    if (process.env.NODE_ENV !== 'production' && stack) {
      error.stack = stack;
    }

    return output(statusCode, JSON.stringify({
      success: false,
      error,
      meta: {
        timestamp: new Date().toISOString()
      }
    }), {
      "content-type": "application/json"
    });
  }

  return {
    type: "Http" as const,
    request: request,
    auth: auth,
    response: response,
    model<T = Record<string, any>>() {
      return JSON.parse(request.body || "{}") as T
    },
    params<T = Record<string, string>>() {
      return {
        ...request.params || {},
        ...querystring.parse(request.rawQueryString || ""),
      } as T;
    },

    output: output,

    error(message: string, code?: ErrorCode, details?: Record<string, any>, stack?: string) {
      error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        code || ErrorCode.INTERNAL_SERVER_ERROR,
        message,
        details,
        stack);
    },
    success<T>(data: T) {
      return output(HttpStatus.OK, JSON.stringify({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString()
        }
      } as ApiContentResponse<T>), {
        "content-type": "application/json"
      })
    },
    list<T>(
      items: T[],
      page: number,
      pageSize: number,
      totalItems: number
    ) {
      const totalPages = Math.ceil(totalItems / pageSize);

      return output(HttpStatus.OK, JSON.stringify({
        success: true,
        data: items,
        meta: {
          page,
          pageSize,
          totalItems,
          totalPages,
          timestamp: new Date().toISOString()
        }
      } as ApiListResponse<T>), {
        "content-type": "application/json"
      });
    },
    created<T>(data: T) {
      return output(HttpStatus.CREATED, JSON.stringify({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString()
        }
      } as ApiContentResponse<T>), {
        "content-type": "application/json"
      });
    },
    deleted(id?: string | number) {
      return output(HttpStatus.OK, JSON.stringify({
        success: true,
        data: {
          deleted: true,
          id
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      } as ApiDeleteResponse), {
        "content-type": "application/json"
      });
    },
    notFound(resource: string, id?: string | number) {
      const message = id
        ? `${resource} with ID ${id} was not found`
        : `${resource} not found`;

      return error(
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
        message
      );
    },
    validationError(details: Record<string, any>) {
      return error(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        details
      );
    },
    serverError(err: Error) {
      return error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred',
        {},
        err.stack
      );
    },
    businessError(message: string, details?: Record<string, any>) {
      return error(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUSINESS_RULE_VIOLATION,
        message,
        details
      );
    }
  };
}
