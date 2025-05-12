import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verifyJWT } from "../libs/JWTUtils.ts";
import sqlHandler from "../libs/SqlHandler.ts";
import { ErrorMessages, ErrorType } from "../enums/ErrorType.ts";

/**
 ** Authentication middleware
 * Verifies the access token and sets user info in context
 * @param {Context} ctx - The Oak context
 * @param {Function} next - The next middleware function
 */
export async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
    const accessToken = await ctx.cookies.get('accessToken');
    
    if (!accessToken) {
        console.log("❌ No access token provided");
        ctx.response.status = ErrorType.ACCESS_DENIED;
        ctx.response.body = { data: "Unauthorized: No token provided" };
        return;
    }
    
    const payload = await verifyJWT(accessToken);
    
    if (!payload) {
        console.log("❌ Invalid access token");
        ctx.response.status = ErrorType.ACCESS_DENIED;
        ctx.response.body = { data: "Unauthorized: Invalid token" };
        return;
    }
    
    ctx.state.user = {
        id: payload.userId,
        username: payload.username,
        role: payload.role
    };

    // Check if the user is banned
    if (sqlHandler.isBanned(ctx.state.user.id).banned) {
        console.log("❌ User is banned");
        ctx.response.status = ErrorType.BANNED;
        ctx.response.body = ErrorMessages[ErrorType.BANNED];
        return;
    }

    await next();
}
