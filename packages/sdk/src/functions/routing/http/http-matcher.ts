import { HttpMethod } from "@@types"

export const httpMatcher = (method: HttpMethod, urlPattern: string) =>
    (handlerType: string, event?: any) => {
        // Is HTTP Context present
        if (handlerType != "Http")
            return false;

        // Does Method match
        const requestMethod = event?.requestContext?.http?.method;
        const matchingKey = event?.rawPath;

        if (!requestMethod || !matchingKey) {
            return false;
        }
        return (
            method.toLowerCase() === requestMethod.toLowerCase() &&
            urlPattern.toLowerCase() === matchingKey.toLowerCase()
        );
    };