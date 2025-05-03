import {
  Application,
  type ListenOptions,
  Router,
  send,
} from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import * as _bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { initiateNewPlayer, removePlayer } from "./libs/PlayerHandler.ts";
import { ServerPhysics } from "./libs/ServerPhysics.ts";
import { MessageTypeEnum } from "../shared/MessageTypeEnum.ts";
import sqlHandler from "./libs/SqlHandler.ts";
import commandHandler, { EffectType } from "./libs/CommandHandler.ts";
import { players } from "./libs/PlayerHandler.ts";

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
  port: Number(Deno.args[0]),
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

  ws.onmessage = async (event) => {
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

      case MessageTypeEnum.GET_CHAT_MESSAGES: {
        console.log(`Chat messages requested`);
        const matchId = 1; //TODO: get match id from the current match
        const messages = await sqlHandler.getChatMessages(matchId);

        if (messages.length === 0) break;
        ws.send(
          JSON.stringify({
            type: MessageTypeEnum.GET_CHAT_MESSAGES,
            messages: messages,
          }),
        );
        break;
      }

      case MessageTypeEnum.SEND_CHAT_MESSAGE: {
        let playerId = -1;
        if (!(await sqlHandler.doUserExists(data.name))) {
          const passwordHash = await _bcrypt.hash(data.password);
          await sqlHandler.createUser(data.name, passwordHash);
        }
        playerId = await sqlHandler.getUserByName(data.name);
        sqlHandler.changeUserRole(playerId, 2);
        const userRole = await sqlHandler.getUserRole(playerId);
        const matchId = 1;

        if (data.message.startsWith("/")) {
          const commandText = data.message.substring(1);

          const result = await commandHandler.executeCommand(
            commandText,
            data.name,
            userRole,
          );

          ws.send(JSON.stringify({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: result.message,
            role: 3,
          }));

          switch (result.effect.type) {
            case EffectType.KILL: {
              if (!result.effect.target) break;
              if (players[result.effect.target]) {
                players[result.effect.target].health = 0;

                if (result.effect.target === data.name) {
                  notifyAll(`${data.name} s'est suicidé`, ws);
                } else {
                  notifyAll(
                    `${result.effect.target} a été tué par ${data.name}`,
                    ws,
                  );
                }
              }
              break;
            }
            case EffectType.PRIVATE_MESSAGE: {
              if (!result.effect.target || !players[result.effect.target]) {
                break;
              }

              const targetWs = players[result.effect.target].websocket;

              console.log("Tentative d'envoi de MP");
              console.log("Joueur cible:", result.effect.target);
              console.log(
                "Objet joueur complet:",
                players[result.effect.target],
              );
              console.log(
                "Propriétés disponibles:",
                Object.keys(players[result.effect.target]),
              );

              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                console.log("WebSocket trouvé et ouvert, envoi du message");
                targetWs.send(JSON.stringify({
                  type: MessageTypeEnum.SEND_CHAT_MESSAGE,
                  name: `MP de ${data.name}`,
                  message: result.effect.reason,
                  role: userRole,
                }));
              } else {
                console.log("WebSocket non disponible:", targetWs);
                console.log(
                  "État de la connexion:",
                  targetWs ? targetWs.readyState : "undefined",
                );
              }
              break;
            }
            case EffectType.BAN: {
              if (!result.effect.target) break;
              const bannedPlayerId = await sqlHandler.getUserByName(
                result.effect.target,
              );
              if (bannedPlayerId > 0) {
                await sqlHandler.addBan(
                  bannedPlayerId,
                  result.effect.reason,
                  playerId,
                  result.effect.expiryDate,
                );
                removePlayer(result.effect.target);
                const durationText = result.effect.expiryDate
                  ? `temporairement (jusqu'au ${result.effect.expiryDate.toLocaleString()})`
                  : "définitivement";
                notifyAll(
                  `${result.effect.target} a été banni ${durationText} par ${data.name} pour: ${result.effect.reason}`,
                  ws,
                );
              }
              break;
            }
            case EffectType.MUTE: {
              if (!result.effect.target) break;
              const mutedPlayerId = await sqlHandler.getUserByName(
                result.effect.target,
              );
              if (mutedPlayerId > 0) {
                await sqlHandler.addMute(
                  mutedPlayerId,
                  result.effect.reason,
                  playerId,
                  result.effect.expiryDate,
                );
                const durationText = result.effect.expiryDate
                  ? `temporairement (jusqu'au ${result.effect.expiryDate.toLocaleString()})`
                  : "définitivement";
                notifyAll(
                  `${result.effect.target} a été rendu muet ${durationText} par ${data.name} pour: ${result.effect.reason}`,
                  ws,
                );
              }
              break;
            }
            case EffectType.UNBAN: {
              if (!result.effect.target) break;
              const unbannedPlayerId = await sqlHandler.getUserByName(
                result.effect.target,
              );
              if (unbannedPlayerId > 0) {
                await sqlHandler.removeBan(unbannedPlayerId);
                notifyAll(
                  `${result.effect.target} a été débanni par ${data.name}`,
                  ws,
                );
              }
              break;
            }

            case EffectType.UNMUTE: {
              if (!result.effect.target) break;
              const unmutedPlayerId = await sqlHandler.getUserByName(
                result.effect.target,
              );
              if (unmutedPlayerId > 0) {
                await sqlHandler.removeMute(unmutedPlayerId);
                notifyAll(
                  `${result.effect.target} a été démuté par ${data.name}`,
                  ws,
                );
              }
              break;
            }
            default: {
              break;
            }
          }
        } else {
          const muteStatus = await sqlHandler.isMuted(playerId);
          if (muteStatus.muted) {
            const expiryText = muteStatus.expiry
              ? `jusqu'au ${muteStatus.expiry.toLocaleString()}`
              : "définitivement";
            ws.send(JSON.stringify({
              type: MessageTypeEnum.SEND_CHAT_MESSAGE,
              name: "Système",
              message:
                `Vous ne pouvez pas envoyer de message car vous êtes muet ${expiryText}. Raison: ${muteStatus.reason}`,
              role: 3,
            }));
          } else {
            sqlHandler.addChatMessage(playerId, matchId, data.message);
            for (const connection of connections) {
              connection.send(
                JSON.stringify({
                  type: MessageTypeEnum.SEND_CHAT_MESSAGE,
                  name: data.name,
                  message: data.message,
                  role: userRole,
                }),
              );
            }
          }
        }
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

function notifyAll(message: string, excludeConnection?: WebSocket) {
  for (const connection of connections) {
    if (connection === excludeConnection) continue;

    connection.send(JSON.stringify({
      type: MessageTypeEnum.SEND_CHAT_MESSAGE,
      name: "Système",
      message: message,
      role: 3,
    }));
  }
}
