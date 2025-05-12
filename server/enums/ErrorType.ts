export enum ErrorType {
  // HTTP status code based errors
  BAD_REQUEST = 400,
  AUTH_REQUIRED = 401,
  ACCESS_DENIED = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  BANNED = 410,
  RATE_LIMITED = 429,
  SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,

  // Custom application errors
  SERVER_UNREACHABLE = 600,
  AUTH_FAILED = 601,
  TOO_MANY_REQUESTS = 602,
  UNKNOWN = 699,
}

export const ErrorMessages: Record<ErrorType, string> = {
  [ErrorType.SERVER_UNREACHABLE]: "Cannot connect to the server",
  [ErrorType.AUTH_REQUIRED]: "Authentication required",
  [ErrorType.AUTH_FAILED]: "Authentication failed",
  [ErrorType.ACCESS_DENIED]: "Access denied",
  [ErrorType.BANNED]: "Your account is banned",
  [ErrorType.RATE_LIMITED]: "Rate limit exceeded",
  [ErrorType.SERVER_ERROR]: "Internal server error",
  [ErrorType.SERVICE_UNAVAILABLE]: "Service unavailable",
  [ErrorType.BAD_REQUEST]: "Bad request",
  [ErrorType.NOT_FOUND]: "Resource not found",
  [ErrorType.CONFLICT]: "Resource conflict",
  [ErrorType.UNKNOWN]: "Unknown error",
  [ErrorType.TOO_MANY_REQUESTS]: "Too many requests",
};

export function getErrorTypeFromHttpStatus(status: number): ErrorType {
  if (status >= 400 && status < 600) {
    const errorType = status as ErrorType;
    if (ErrorType[errorType] !== undefined) {
      return errorType;
    }
  }

  if (status >= 600 && status < 700) {
    const errorValues = Object.values(ErrorType).filter((val) =>
      typeof val === "number"
    );
    const matchedError = errorValues.find((val) => val === status);
    if (matchedError !== undefined) {
      return matchedError as ErrorType;
    }
  }

  return ErrorType.UNKNOWN;
}

export type ErrorResponse = {
  error: ErrorType;
  message: string;
  details?: Record<string, unknown>;
};
