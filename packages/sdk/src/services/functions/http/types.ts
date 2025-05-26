//#region [Standard structure]
export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ApiResponseMeta;
}

export type ApiError = {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string; // Only included in development
}

export type ApiResponseMeta = {
    // Pagination fields
    page?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;

    // Additional metadata
    timestamp?: string;
    requestId?: string;
}

export interface ApiContentResponse<T> extends ApiResponse<T> {
    data: T;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        timestamp: string;
    };
}

export interface ApiDeleteResponse extends ApiResponse<{ deleted: boolean }> {
    data: {
        deleted: boolean;
        id?: string | number;
    };
}

export interface ErrorResponse extends ApiResponse {
    success: false;
    error: ApiError;
}

/**
 * HTTP status codes mapped to descriptive names
 */
export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
}

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