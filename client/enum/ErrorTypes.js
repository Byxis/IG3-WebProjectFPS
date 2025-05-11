export const ErrorTypes = {
  // HTTP status code based errors
  BAD_REQUEST: 400,
  AUTH_REQUIRED: 401,
  ACCESS_DENIED: 403,
  CONFLICT: 409,
  BANNED: 410,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  
  // Custom application errors
  SERVER_UNREACHABLE: 600,
  AUTH_FAILED: 601,
  UNKNOWN: 699
};
