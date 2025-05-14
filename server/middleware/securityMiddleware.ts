import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {
  ACCESS_TOKEN_EXP,
  createTokenPair,
  REFRESH_TOKEN_EXP,
  verifyJWT,
} from "../libs/JWTUtils.ts";
import sqlHandler from "../libs/SqlHandler.ts";
import { ErrorType } from "../enums/ErrorType.ts";
import { API_URL, WSS_URL } from "../config/config.ts";

/**
 ** Middleware to refresh an expired access token using refresh token
 * @param {Context} ctx - The Oak context
 */
export async function refreshTokenMiddleware(ctx: Context) {
  const token = await ctx.cookies.get("refreshToken");

  if (!token) {
    console.log("❌ No refresh token provided");
    ctx.response.status = 401;
    ctx.response.body = { error: "Refresh token manquant" };
    return;
  }

  const payload = await verifyJWT(token);

  if (!payload || payload.type !== "refresh") {
    console.log("❌ Invalid refresh token");
    ctx.response.status = 401;
    ctx.response.body = { error: "Refresh token invalide" };
    return;
  }

  const userId = await sqlHandler.getUserByName(payload.username);
  if (userId <= 0) {
    console.log("❌ Unknown user");
    ctx.response.status = 401;
    ctx.response.body = { error: "Utilisateur inconnu" };
    return;
  }

  const isValidToken = sqlHandler.verifyRefreshToken(userId, token);
  if (!isValidToken) {
    console.log("❌ Revoked or invalid refresh token");
    ctx.response.status = 401;
    ctx.response.body = { error: "Refresh token révoqué ou invalide" };
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
  };
}

const loginAttempts = new Map();

/**
 ** Rate limiting middleware to prevent brute force attacks
 * @param {Context} ctx - The Oak context
 * @param {Function} next - The next middleware function
 */
export function rateLimiter(ctx: Context, next: () => Promise<unknown>) {
  const ip = ctx.request.ip;
  const now = Date.now();

  if (loginAttempts.has(ip)) {
    const attempts = loginAttempts.get(ip);

    if (attempts.count >= 5 && now - attempts.timestamp < 15 * 60 * 1000) {
      console.log(`❌ Trop de tentatives de connexion depuis l'IP ${ip}`);
      ctx.response.status = ErrorType.TOO_MANY_REQUESTS.valueOf();
      ctx.response.body = {
        error: "Too many login attempts. Please try again later.",
      };
      return;
    }

    if (now - attempts.timestamp > 15 * 60 * 1000) {
      loginAttempts.set(ip, { count: 1, timestamp: now });
    } else {
      loginAttempts.set(ip, {
        count: attempts.count + 1,
        timestamp: attempts.timestamp,
      });
    }
  } else {
    loginAttempts.set(ip, { count: 1, timestamp: now });
  }

  return next();
}

/**
 ** CSRF protection middleware
 * @param {Context} ctx - The Oak context
 * @param {Function} next - The next middleware function
 */
export const csrfProtection = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  if (ctx.request.method !== "GET") {
    const origin = ctx.request.headers.get("Origin");

    if (!origin || !origin.startsWith("https://localhost:8080")) {
      console.log("❌ CSRF validation failed: Invalid origin");
      ctx.response.status = 403;
      ctx.response.body = { error: "CSRF validation failed" };
      return;
    }
  }

  await next();
};

/**
 ** Content Security Policy middleware
 * @param {Context} ctx - The Oak context
 * @param {Function} next - The next middleware function
 */
export const cspMiddleware = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  ctx.state.cspNonce = nonce;

  const trustedDomains = {
    scripts: [
      "'self'",
      `'nonce-${nonce}'`,
      "cdn.skypack.dev",
      "localhost:3000",
    ].join(" "),
    styles: [
      "'self'",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      "cdnjs.cloudflare.com",
    ].join(" "),
    fonts: [
      "'self'",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
    ].join(" "),
    images: [
      "'self'",
      "data:",
    ].join(" "),
  };

  const cspDirectives = [
    `default-src 'self'`,
    `script-src ${trustedDomains.scripts}`,
    `style-src ${trustedDomains.styles}`,
    `font-src ${trustedDomains.fonts}`,
    `img-src ${trustedDomains.images}`,
    `connect-src 'self' ${API_URL} ${WSS_URL}`,
  ].join("; ");

  ctx.response.headers.set("Content-Security-Policy", cspDirectives);
  ctx.response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");

  await next();
};
