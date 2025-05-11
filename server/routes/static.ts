import { Router, send } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ErrorType } from "../enums/ErrorType.ts";

const staticRoutes = new Router();

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
        console.error(`❌ Error reading directory: ${error.message}`);
        ctx.response.status = ErrorType.NOT_FOUND;
        ctx.response.body = { error: "Failed to read directory" };
    }
});

staticRoutes.get("/shared/:path+", async (ctx) => {
    const path = ctx.params.path as string;
    
    const sharedPath = join(Deno.cwd(), "shared");
    const filePath = join(sharedPath, path);
    
    try {
        const fileInfo = await Deno.stat(filePath);
        
        await send(ctx, path, {
            root: sharedPath
        });
    } catch (error) {
        console.error(`❌ Error with file ${path}:`, error.message);
        ctx.response.status = ErrorType.NOT_FOUND;
        ctx.response.body = "File not found";
    }
});

console.log("- Static routes loaded ✅");

export { staticRoutes };
