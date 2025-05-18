import { Context, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import sqlHandler from "../libs/SqlHandler.ts";
import {
  ACCESS_TOKEN_EXP,
  createTokenPair,
  getHash,
  REFRESH_TOKEN_EXP,
  verifyJWT,
} from "../libs/JWTUtils.ts";
import {
  csrfProtection,
  rateLimiter,
} from "../middleware/securityMiddleware.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import {
  ErrorResponse,
  ErrorType,
  getErrorTypeFromHttpStatus,
} from "../enums/ErrorType.ts";

const authRoutes = new Router();

/**
 ** Creates an error response with consistent format
 * @param {Context} ctx - The Oak context
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Record<string, unknown>} [details] - Additional error details
 */
const errorResponse = (
  ctx: Context,
  status: number,
  message: string,
  details?: Record<string, unknown>,
) => {
  const errorType = typeof getErrorTypeFromHttpStatus === "function"
    ? getErrorTypeFromHttpStatus(status)
    : ErrorType.UNKNOWN;

  ctx.response.status = status;
  ctx.response.body = {
    error: errorType,
    message,
    details,
  } as ErrorResponse;
};

/**
 ** User registration handler
 */
authRoutes.post("/register", csrfProtection, async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;

  if (!username || !password) {
    return errorResponse(
      ctx,
      ErrorType.BAD_REQUEST,
      "Username and password required",
    );
  }

  if (password.length < 6) {
    return errorResponse(
      ctx,
      ErrorType.BAD_REQUEST,
      "Password must be at least 6 characters",
    );
  }

  if (await sqlHandler.doUserExists(username)) {
    return errorResponse(
      ctx,
      ErrorType.CONFLICT,
      "Username already taken",
    );
  }

  const passwordHash = await getHash(password);
  const userResult = await sqlHandler.createUser(username, passwordHash);
  const userId = Number(userResult[0][0]);

  const userRole = await sqlHandler.getUserRole(userId);
  const tokens = await createTokenPair({
    userId: userId,
    username: username,
    role: userRole,
  });

  sqlHandler.storeRefreshToken(
    userId,
    tokens.refreshToken,
    REFRESH_TOKEN_EXP,
  );

  ctx.cookies.set("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000), // Convert ms to seconds
  });

  ctx.cookies.set("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000), // Convert ms to seconds
  });

  ctx.response.status = 201;
  ctx.response.body = {
    username: username,
  };
});

/**
 ** User login handler
 */
authRoutes.post("/login", csrfProtection, rateLimiter, async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;

  const userId = Number(await sqlHandler.getUserByName(username));
  if (userId <= 0) {
    return errorResponse(
      ctx,
      ErrorType.AUTH_REQUIRED,
      "Invalid credentials",
      { reason: "Username not found" },
    );
  }

  const passwordHash = await sqlHandler.getUserPasswordHash(userId);
  const isValid = await bcrypt.compare(password, passwordHash);

  if (!isValid) {
    return errorResponse(
      ctx,
      ErrorType.AUTH_REQUIRED,
      "Invalid credentials",
      { reason: "Incorrect password" },
    );
  }
  const isBanned = sqlHandler.isBanned(userId);

  if (isBanned.banned) {
    return errorResponse(ctx, ErrorType.BANNED, "User banned", {
      reason: "You are banned for the following reason: " + isBanned.reason +
        " until " + isBanned.expiry,
    });
  }

  const userRole = await sqlHandler.getUserRole(userId);
  const tokens = await createTokenPair({
    userId: userId,
    username: username,
    role: userRole,
  });

  sqlHandler.storeRefreshToken(
    userId,
    tokens.refreshToken,
    REFRESH_TOKEN_EXP,
  );

  ctx.cookies.set("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000),
  });

  ctx.cookies.set("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000),
  });

  ctx.response.body = {
    username: username,
  };
  console.log("✅ User logged in successfully");
});

/**
 ** Token refresh handler
 */
authRoutes.post("/refresh", async (ctx) => {
  const token = await ctx.cookies.get("refreshToken");

  if (!token) {
    console.log("❌ No refresh token provided");
    ctx.response.status = 401;
    ctx.response.body = { error: "Missing refresh token" };
    return;
  }

  const payload = await verifyJWT(token);

  if (!payload || payload.type !== "refresh") {
    console.log("❌ Invalid refresh token");
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid refresh token" };
    return;
  }

  const userId = Number(await sqlHandler.getUserByName(payload.username));
  if (userId <= 0) {
    console.log("❌ Unknown user");
    ctx.response.status = 401;
    ctx.response.body = { error: "Unknown user" };
    return;
  }

  const isValidToken = sqlHandler.verifyRefreshToken(userId, token);
  if (!isValidToken) {
    console.log("❌ Revoked or invalid refresh token");
    ctx.response.status = 401;
    ctx.response.body = { error: "Revoked or invalid refresh token" };
    return;
  }

  sqlHandler.removeRefreshToken(token);

  const userRole = await sqlHandler.getUserRole(userId);
  const newTokens = await createTokenPair({
    userId: userId,
    username: payload.username,
    role: userRole,
  });

  sqlHandler.storeRefreshToken(
    userId,
    newTokens.refreshToken,
    REFRESH_TOKEN_EXP,
  );

  ctx.cookies.set("accessToken", newTokens.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000),
  });

  ctx.cookies.set("refreshToken", newTokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000),
  });

  ctx.response.body = {
    user: payload.username,
    success: true,
    message: "Token successfully refreshed",
  };
  console.log("✅ Token refreshed for user:", payload.username);
});

/**
 ** User logout handler
 */
authRoutes.post("/logout", async (ctx) => {
  const refreshToken = await ctx.cookies.get("refreshToken");
  if (refreshToken) {
    const payload = await verifyJWT(refreshToken);
    if (payload && payload.userId) {
      sqlHandler.removeAllUserRefreshTokens(Number(payload.userId));
    } else {
      sqlHandler.removeRefreshToken(refreshToken);
    }
  }

  ctx.cookies.delete("accessToken");
  ctx.cookies.delete("refreshToken");
  ctx.response.body = { message: "Successfully logged out" };
});

console.log("- Auth routes loaded ✅");

export { authRoutes };
