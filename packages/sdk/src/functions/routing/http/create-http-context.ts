import * as querystring from "node:querystring";
import {
  HTTPAuth,
  HTTPRequest,
  HTTPResponse,
  HttpFunctionContext,
  HttpStatusCode
} from "@@types";

export function createHttpContext(
  request: HTTPRequest,
  auth?: HTTPAuth
): HttpFunctionContext {
  const response: HTTPResponse = {
    body: undefined,
    headers: {},
    status: HttpStatusCode.OK
  };

  const output = (status: number, body?: string, headers?: any) => {
    response.status = status;
    response.headers = {
      ...response.headers,
      ...headers
    };
    response.body = body;
  };

  return {
    type: "Http",
    request,
    auth,
    response,
    model<T = Record<string, any>>() {
      return JSON.parse(request.body || "{}") as T;
    },
    params<T = Record<string, string>>() {
      return {
        ...request.params || {},
        ...querystring.parse(request.rawQueryString || ""),
      } as T;
    },
    output: () => response,
    success(body) {
      if (body)
        return output(HttpStatusCode.OK, JSON.stringify(body), {
          "content-type": "application/json"
        });
      return output(HttpStatusCode.OK, "request success");
    },
    accepted(body) {
      if (body)
        return output(HttpStatusCode.ACCEPTED, JSON.stringify(body), {
          "content-type": "application/json"
        });
      return output(HttpStatusCode.ACCEPTED, "request accepted");
    },
    failed(body) {
      if (body)
        return output(HttpStatusCode.BAD_REQUEST, JSON.stringify(body), {
          "content-type": "application/json"
        });
      return output(HttpStatusCode.BAD_REQUEST, "bad request");
    },
    error(body) {
      if (body)
        return output(HttpStatusCode.INTERNAL_SERVER_ERROR, JSON.stringify(body), {
          "content-type": "application/json"
        });
      return output(HttpStatusCode.INTERNAL_SERVER_ERROR, "internal server error");
    },
    notFound(body) {
      if (body)
        return output(HttpStatusCode.NOT_FOUND, JSON.stringify(body), {
          "content-type": "application/json"
        });
      return output(HttpStatusCode.NOT_FOUND, "resource not found");
    }
  };
}