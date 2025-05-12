export var ErrorType;
(function (ErrorType) {
    // HTTP status code based errors
    ErrorType[ErrorType["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    ErrorType[ErrorType["AUTH_REQUIRED"] = 401] = "AUTH_REQUIRED";
    ErrorType[ErrorType["ACCESS_DENIED"] = 403] = "ACCESS_DENIED";
    ErrorType[ErrorType["NOT_FOUND"] = 404] = "NOT_FOUND";
    ErrorType[ErrorType["CONFLICT"] = 409] = "CONFLICT";
    ErrorType[ErrorType["BANNED"] = 410] = "BANNED";
    ErrorType[ErrorType["RATE_LIMITED"] = 429] = "RATE_LIMITED";
    ErrorType[ErrorType["SERVER_ERROR"] = 500] = "SERVER_ERROR";
    ErrorType[ErrorType["SERVICE_UNAVAILABLE"] = 503] = "SERVICE_UNAVAILABLE";
    // Custom application errors
    ErrorType[ErrorType["SERVER_UNREACHABLE"] = 600] = "SERVER_UNREACHABLE";
    ErrorType[ErrorType["AUTH_FAILED"] = 601] = "AUTH_FAILED";
    ErrorType[ErrorType["UNKNOWN"] = 699] = "UNKNOWN";
})(ErrorType || (ErrorType = {}));
export const ErrorMessages = {
    [ErrorType.SERVER_UNREACHABLE]: 'Cannot connect to the server',
    [ErrorType.AUTH_REQUIRED]: 'Authentication required',
    [ErrorType.AUTH_FAILED]: 'Authentication failed',
    [ErrorType.ACCESS_DENIED]: 'Access denied',
    [ErrorType.BANNED]: 'Your account is banned',
    [ErrorType.RATE_LIMITED]: 'Rate limit exceeded',
    [ErrorType.SERVER_ERROR]: 'Internal server error',
    [ErrorType.SERVICE_UNAVAILABLE]: 'Service unavailable',
    [ErrorType.BAD_REQUEST]: 'Bad request',
    [ErrorType.NOT_FOUND]: 'Resource not found',
    [ErrorType.CONFLICT]: 'Resource conflict',
    [ErrorType.UNKNOWN]: 'Unknown error'
};
export function getErrorTypeFromHttpStatus(status) {
    if (status >= 400 && status < 600) {
        const errorType = status;
        if (ErrorType[errorType] !== undefined) {
            return errorType;
        }
    }
    if (status >= 600 && status < 700) {
        const errorValues = Object.values(ErrorType).filter(val => typeof val === 'number');
        const matchedError = errorValues.find(val => val === status);
        if (matchedError !== undefined) {
            return matchedError;
        }
    }
    return ErrorType.UNKNOWN;
}
