import { BaseEntry } from "./base";

export type HttpMethod = "GET" | "PUT" | "POST" | "PATCH" | "DELETE";

export type HttpTrigger = {
    type: "http"
    options: {
        route: string,
        method: HttpMethod
    }
}

export type HttpEntry = BaseEntry<HttpTrigger>;
