import { Router, send } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ErrorType } from "../enums/ErrorType.ts";

const staticRoutes = new Router();

/**
 ** Lists all files in the shared directory
 */
staticRoutes.get("/shared", (ctx) => {
  console.log("📂 Listing shared files...");
  const files = [];
  const sharedPath = join(Deno.cwd(), "shared");

  try {
    for (const file of Deno.readDirSync(sharedPath)) {
      files.push(file.name);
    }
    ctx.response.body = files;
    ctx.response.type = "application/json";
  } catch (error) {
    console.error(`❌ Error reading directory: ${(error as Error).message}`);
    ctx.response.status = ErrorType.NOT_FOUND.valueOf();
    ctx.response.body = { error: "Failed to read directory" };
  }
});

/**
 ** Serves files from the shared directory
 */
staticRoutes.get("/shared/:path+", async (ctx) => {
  const path = ctx.params.path as string;

  const sharedPath = join(Deno.cwd(), "shared");
  try {
    await send(ctx, path, {
      root: sharedPath,
    });
  } catch (error) {
    console.error(`❌ Error with file ${path}:`, (error as Error).message);
    ctx.response.status = ErrorType.NOT_FOUND.valueOf();
    ctx.response.body = "File not found";
  }
});

console.log("- Static routes loaded ✅");

export { staticRoutes };
