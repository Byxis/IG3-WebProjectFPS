import {
  Application,
  type ListenOptions,
} from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { ServerPhysics } from "./libs/ServerPhysics.ts";
import { router } from "./routes/index.ts";
import { setupWebSocketServer } from "./websocketManager.ts";
import { cspMiddleware } from "./middleware/securityMiddleware.ts";
import { GameLoop } from "./libs/GameLoop.ts";
import { matchManager } from "./libs/MatchManager.ts";
import sqlHandler from "./libs/SqlHandler.ts";

const serverPhysics = new ServerPhysics();

console.log("✅ Server started ✅\n");

const gameLoop = new GameLoop(60, () => {
  serverPhysics.updateAll();
});
gameLoop.start();

(async () => {
  const cleanedMatches = sqlHandler.cleanupStaleMatches();
  if (cleanedMatches > 0) {
    console.log(
      `Cleaned up ${cleanedMatches} stale matches from previous sessions`,
    );
  }

  const recoveredMatchId = await matchManager.tryRecoverActiveMatch();

  if (recoveredMatchId) {
    console.log(`Successfully recovered match with ID: ${recoveredMatchId}`);
  } else {
    const matchId = await matchManager.initializeMatch();
    console.log(`No active match found, started new match with ID: ${matchId}`);
  }
})();

const app = new Application();

app.use(
  oakCors({
    origin: "https://localhost:8080",
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cspMiddleware);

app.use(async (ctx, next) => {
  await next();

  const contentType = ctx.response.headers.get("Content-Type");
  if (contentType && contentType.includes("text/html") && ctx.state.cspNonce) {
    if (typeof ctx.response.body === "string") {
      ctx.response.body = ctx.response.body.replace(
        /<script>/g,
        `<script nonce="${ctx.state.cspNonce}">`,
      );
    }
  }
});

if (Deno.args.length < 1) {
  console.log(
    `Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

let options: ListenOptions = {
  port: Number(Deno.args[0]),
};

if (Deno.args.length >= 3) {
  const cert = await Deno.readTextFile(Deno.args[1]);
  const key = await Deno.readTextFile(Deno.args[2]);

  options = {
    port: Number(Deno.args[0]),
    secure: true,
    cert: cert,
    key: key,
  };
  console.log(`SSL conf ready (use https) 🔐`);
} else {
  options = {
    port: Number(Deno.args[0]),
    secure: true,
    cert: "",
    key: "",
  };
}

console.log(`Oak back server running on port ${options.port} 🚀`);

if (Deno.args.includes("--debug")) {
  app.use(async (ctx, next) => {
    console.log(
      `Request received: ${ctx.request.method} ${ctx.request.url.pathname} from ${ctx.request.ip}`,
    );
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`Response: ${ctx.response.status} in ${ms}ms`);
  });
}

app.use(setupWebSocketServer(serverPhysics));

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen(options);
