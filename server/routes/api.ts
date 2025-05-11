import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { authMiddleware } from "../middleware/authMiddleware.ts";

const apiRoutes = new Router();

// Endpoint to verify authentication
apiRoutes.get("/verify", authMiddleware, (ctx) => {
  ctx.response.body = { 
      valid: true,
      user: ctx.state.user 
  };
});

// Clock synchronization endpoint
apiRoutes.get("/sync", (ctx) => {
  ctx.response.body = Date.now().toString();
});

console.log("- API routes loaded ✅");

export { apiRoutes };
