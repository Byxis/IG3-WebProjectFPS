import { Router, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import sqlHandler from "../libs/SqlHandler.ts";
import { 
  getHash, 
  createTokenPair, 
  verifyJWT,
  ACCESS_TOKEN_EXP,
  REFRESH_TOKEN_EXP
} from "../libs/JWTUtils.ts";
import { rateLimiter, csrfProtection, refreshTokenMiddleware } from "../middleware/securityMiddleware.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { ErrorType, ErrorResponse, getErrorTypeFromHttpStatus } from "../enums/ErrorType.ts";

const authRoutes = new Router();

// Error response utility function
const errorResponse = (ctx: Context, status: number, message: string, details?: Record<string, any>) => {
  const errorType = getErrorTypeFromHttpStatus[status] || ErrorType.UNKNOWN;
  
  ctx.response.status = status;
  ctx.response.body = {
    error: errorType,
    message,
    details
  } as ErrorResponse;
};

// Register route
authRoutes.post("/register", csrfProtection, async (ctx) => {
    const body = await ctx.request.body.json();
    const { username, password } = body;
    
    if (!username || !password) {
        return errorResponse(ctx, ErrorType.BAD_REQUEST, "Nom d'utilisateur et mot de passe requis");
    }
    
    if (password.length < 6) {
        return errorResponse(ctx, ErrorType.BAD_REQUEST, "Le mot de passe doit contenir au moins 6 caractères");
    }
    
    if (await sqlHandler.doUserExists(username)) {
        return errorResponse(ctx, ErrorType.CONFLICT, "Nom d'utilisateur déjà pris");
    }
    
    const passwordHash = await getHash(password);
    const userResult = await sqlHandler.createUser(username, passwordHash);
    const userId = userResult[0][0];
    
    const userRole = await sqlHandler.getUserRole(userId);
    const tokens = await createTokenPair({
        userId: userId,
        username: username,
        role: userRole
    });
    
    sqlHandler.storeRefreshToken(
        userId, 
        tokens.refreshToken, 
        REFRESH_TOKEN_EXP
    );
    
    ctx.cookies.set('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000) // Convert ms to seconds
    });
    
    ctx.cookies.set('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000) // Convert ms to seconds
    });
    
    ctx.response.status = 201;
    ctx.response.body = {
        username: username
    };
});

// Login route
authRoutes.post("/login", csrfProtection, rateLimiter, async (ctx) => {
    const body = await ctx.request.body.json();
    const { username, password } = body;
    
    const userId = await sqlHandler.getUserByName(username);
    if (userId <= 0) {
        return errorResponse(ctx, ErrorType.AUTH_REQUIRED, "Identifiants invalides", { reason: "Nom d'utilisateur introuvable" });
    }
    
    const passwordHash = await sqlHandler.getUserPasswordHash(userId);
    const isValid = await bcrypt.compare(password, passwordHash);
    
    if (!isValid) {
        return errorResponse(ctx, ErrorType.AUTH_REQUIRED, "Identifiants invalides", { reason: "Mot de passe incorrect" });
    }
    const isBanned = sqlHandler.isBanned(userId);
        
    if (isBanned.banned)
    {
        return errorResponse(ctx, ErrorType.BANNED, "Utilisateur banni", { reason: "Vous êtes banni pour la raison suivante : "+isBanned.reason +" jusqu'au "+ isBanned.expiry });
    }
    
    const userRole = await sqlHandler.getUserRole(userId);
    const tokens = await createTokenPair({
        userId: userId,
        username: username,
        role: userRole
    });
        
    sqlHandler.storeRefreshToken(
        userId, 
        tokens.refreshToken, 
        REFRESH_TOKEN_EXP
    );
    
    ctx.cookies.set('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000)
    });
    
    ctx.cookies.set('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000)
    });
    
    ctx.response.body = {
        username: username
    };
    console.log("✅ User logged in successfully");
});

// Refresh token route
authRoutes.post("/refresh", async (ctx) => {
    const token = await ctx.cookies.get('refreshToken');
    
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
        role: userRole
    });
    
    sqlHandler.storeRefreshToken(
        userId, 
        newTokens.refreshToken, 
        REFRESH_TOKEN_EXP
    );
    
    ctx.cookies.set('accessToken', newTokens.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(ACCESS_TOKEN_EXP / 1000)
    });
    
    ctx.cookies.set('refreshToken', newTokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: Math.floor(REFRESH_TOKEN_EXP / 1000)
    });
    
    ctx.response.body = {
        user: payload.username,
        success: true,
        message: "Token successfully refreshed"
    };
    console.log("✅ Token refreshed for user:", payload.username);
});

// Logout route
authRoutes.post("/logout", async (ctx) => {
  const refreshToken = await ctx.cookies.get('refreshToken');
  if (refreshToken) {
      const payload = await verifyJWT(refreshToken);
      if (payload && payload.userId) {
          sqlHandler.removeAllUserRefreshTokens(payload.userId);
      } else {
          sqlHandler.removeRefreshToken(refreshToken);
      }
  }
  
  ctx.cookies.delete('accessToken');
  ctx.cookies.delete('refreshToken');
  ctx.response.body = { message: "Déconnecté avec succès" };
});

console.log("- Auth routes loaded ✅");

export { authRoutes };
