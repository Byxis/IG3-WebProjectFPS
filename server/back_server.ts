import {
  Application,
  Router,
  send,
  type ListenOptions,
} from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import * as _bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import {
  initiateNewPlayer,
  removePlayer,
} from "./libs/PlayerHandler.ts";
import { ServerPhysics } from "./libs/ServerPhysics.ts";
import { MessageTypeEnum } from "../shared/MessageTypeEnum.ts";

const router = new Router();
const app = new Application();
export const connections: WebSocket[] = [];
const serverPhysics = new ServerPhysics();

console.log("Server started");

setInterval(() => {
  serverPhysics.updateAll();
}, 16.67); // 60 FPS

app.use(
  oakCors({
    origin: "http://localhost:8080",
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

if (Deno.args.length < 1) {
  console.log(
    `Usage: $ deno run --allow-net server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

let options: ListenOptions = { 
  port: Number(Deno.args[0])
};

if (Deno.args.length >= 3) {
  const cert = await Deno.readTextFile(Deno.args[1]);
  const key = await Deno.readTextFile(Deno.args[2]);
  
  options = {
    port: Number(Deno.args[0]),
    secure: true,
    certFile: cert,
    keyFile: key,
  };
  console.log(`SSL conf ready (use https)`);
}

console.log(`Oak back server running on port ${options.port}`);

router.get("/", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  const ws = ctx.upgrade();

  connections.push(ws);
  let i = 0;
  console.log("New connection");

  ws.onerror = (_error) => {
    const index = connections.indexOf(ws);

    if (index !== -1) {
      connections.splice(index, 1);
    }
    console.log(`- websocket error`);
  };

  ws.onmessage = (event) => {
    const message = event.data;
    const data = JSON.parse(message);
    const type = MessageTypeEnum[data.type as keyof typeof MessageTypeEnum];

    switch (type) {
      case MessageTypeEnum.ADD_NEW_PLAYER: {
        i++;
        initiateNewPlayer(data.player, ws);
        break;
      }

      case MessageTypeEnum.VERIFY_POSITION: {
        const result = serverPhysics.updatePlayerPosition(
          data.player.name,
          data.player.position,
        );
        if (
          result.corrected &&
          serverPhysics.isSendUpdateAvailable(data.player.name)
        ) {
          serverPhysics.setSendUpdate(data.player.name);
          ws.send(JSON.stringify({
            type: MessageTypeEnum.POSITION_CORRECTION,
            position: result.position,
            rotation: result.rotation,
            pitch: result.pitch,
          }));
        }
        break;
      }

      case MessageTypeEnum.UPDATE_PLAYER_KEYBINDS: {
        serverPhysics.updatePlayerMovement(
          data.name,
          data.movement.forward,
          data.movement.side,
          data.movement.isSprinting,
          data.movement.isJumping,
          data.movement.rotation,
          data.movement.pitch,
          data.networkTimeOffset,
        );
        break;
      }

      case MessageTypeEnum.DISCONNECT: {
        console.log(`Player ${data.name} disconnected`);
        removePlayer(data.name);
        break;
      }

      default: {
        console.log(`Unknown message type: ${data.type}`);
        break;
      }
    }
  };

  ws.onclose = () => {
    const index = connections.indexOf(ws);
    if (index !== -1) {
      connections.splice(index, 1);
    }
    console.log(`- websocket disconnected (${connections.length})`);
  };
});

router.get("/shared", (ctx) => {
  console.log("Showing shared files");
  const files = [];
  for (const file of Deno.readDirSync(`${Deno.cwd()}\\shared\\`)) {
    files.push(file.name);
  }
  ctx.response.body = files;
  ctx.response.type = "application/json";
});

router.get("/shared/:path+", async (ctx) => {
  console.log("Shared file requested");
  const path = ctx.params.path as string;
  try {
    await send(ctx, path, {
      root: `${Deno.cwd()}\\shared\\`,
      index: "index.html",
    });
  } catch (error) {
    console.error(`Error serving shared file: ${path}`, error);
    ctx.response.status = 404;
    ctx.response.body = "File not found";
  }
});

router.get("/api/sync", (ctx) => {
  ctx.response.body = Date.now().toString();
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen(options);
