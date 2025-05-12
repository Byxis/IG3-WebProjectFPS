import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { authRoutes } from "./auth.ts";
import { apiRoutes } from "./api.ts";
import { staticRoutes } from "./static.ts";

const router = new Router();

/**
 ** Base route handler
 */
router.get("/", (ctx) => {
  console.log("Base route accessed");
  ctx.response.body = "FPS Game Server";
});

/**
 ** Ping check endpoint
 */
router.get("/ping", (ctx) => {
  console.log("Ping route accessed");
  ctx.response.body = { message: "pong", timestamp: new Date().toISOString() };
});

// Mount other routers
router.use("", authRoutes.routes(), authRoutes.allowedMethods());
router.use("/api", apiRoutes.routes(), apiRoutes.allowedMethods());
router.use("", staticRoutes.routes(), staticRoutes.allowedMethods());

console.log("\n✅ All routes loaded ✅\n");

export { router };
