import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { authMiddleware } from "./middleware/authMiddleware.ts";
import {
  initiateNewPlayer,
  players,
  removePlayer,
} from "./libs/PlayerHandler.ts";
import { ServerPhysics } from "./libs/ServerPhysics.ts";
import { MessageTypeEnum } from "../shared/MessageTypeEnum.ts";
import sqlHandler from "./libs/SqlHandler.ts";
import commandHandler from "./libs/CommandHandler.ts";
import { CommandEffectType } from "./enums/CommandEffectType.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { ErrorType } from "./enums/ErrorType.ts";

// Custom WebSocket type with username
interface CustomWebSocket extends WebSocket {
  username?: string;
}

// Interface for chat message data
interface ChatMessageData {
  type: string;
  name: string;
  message: string;
  password?: string;
  player?: unknown;
  position?: unknown;
  movement?: {
    forward: number;
    side: number;
    isSprinting: boolean;
    isJumping: boolean;
    rotation: { x: number; y: number; z: number };
    pitch: number;
  };
  networkTimeOffset?: number;
}

export const connections: CustomWebSocket[] = [];

/**
 ** Sets up the WebSocket server with authentication
 * @param {ServerPhysics} serverPhysics - The server physics instance for game updates
 * @returns {Function} Middleware function for handling WebSocket connections
 */
export function setupWebSocketServer(serverPhysics: ServerPhysics) {
  return async (ctx: Context, next: () => Promise<unknown>) => {
    if (ctx.request.url.pathname !== "/ws") {
      return await next();
    }

    await authMiddleware(ctx, async () => {
      if (!ctx.isUpgradable) {
        ctx.throw(ErrorType.BAD_REQUEST);
        return;
      }

      console.log(
        `WebSocket upgrade request from user: ${ctx.state.user?.username}`,
      );
      const ws = ctx.upgrade() as CustomWebSocket;

      connections.push(ws);
      console.log(
        `New authenticated connection for user: ${ctx.state.user?.username}`,
      );

      ws.username = ctx.state.user?.username;

      setupWebSocketHandlers(ws, serverPhysics);
      await next();
    });
  };
}

/**
 ** Sets up event handlers for a WebSocket connection
 * @param {CustomWebSocket} ws - The WebSocket connection
 * @param {ServerPhysics} serverPhysics - The server physics instance
 */
function setupWebSocketHandlers(
  ws: CustomWebSocket,
  serverPhysics: ServerPhysics,
) {
  setTimeout(() => {
    try {
      ws.send(JSON.stringify({
        type: MessageTypeEnum.SEND_CHAT_MESSAGE,
        name: "Système",
        message: `Bienvenue, ${ws.username}! Connection établie.`,
        role: 3,
      }));
      console.log(`Welcome message sent to ${ws.username}`);
    } catch (error) {
      console.error("Failed to send welcome message:", error);
    }
  }, 1000);

  ws.onerror = (error) => {
    const index = connections.indexOf(ws);
    console.error(`WebSocket error for user ${ws.username}:`, error);

    if (index !== -1) {
      connections.splice(index, 1);
    }
    console.log(`- websocket error: ${error}`);
  };

  ws.onmessage = async (event) => {
    try {
      const message = event.data;
      const data = JSON.parse(message) as ChatMessageData;
      const type = MessageTypeEnum[data.type as keyof typeof MessageTypeEnum];

      switch (type) {
        case MessageTypeEnum.ADD_NEW_PLAYER: {
          initiateNewPlayer(
            data.player as {
              name: string;
              position: { x: number; y: number; z: number };
              rotation: { x: number; y: number; z: number };
              pitch: number;
            },
            ws,
          );
          break;
        }

        case MessageTypeEnum.VERIFY_POSITION: {
          const result = serverPhysics.updatePlayerPosition(
            data.name,
            data.position as { x: number; y: number; z: number },
          );
          if (
            result.corrected &&
            serverPhysics.isSendUpdateAvailable(data.name)
          ) {
            serverPhysics.setSendUpdate(data.name);
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
            data.movement?.forward || 0,
            data.movement?.side || 0,
            data.movement?.isSprinting || false,
            data.movement?.isJumping || false,
            data.movement?.rotation || { x: 0, y: 0, z: 0 },
            data.movement?.pitch || 0,
            data.networkTimeOffset || 0,
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
          handleChatMessage(data, ws);
          break;
        }

        default: {
          console.log("Message type not recognized:", data.type);
          break;
        }
      }
    } catch (error) {
      console.error(
        `Error processing WebSocket message from ${ws.username}:`,
        error,
      );
    }
  };

  // Handle WebSocket disconnections
  ws.onclose = () => {
    const index = connections.indexOf(ws);
    if (index !== -1) {
      connections.splice(index, 1);
    }
    console.log(
      `- websocket disconnected for user ${ws.username} (${connections.length} connections remaining)`,
    );
  };
}

/**
 ** Handles incoming chat messages and commands
 * Processes commands and broadcasts regular messages to all players
 * @param {ChatMessageData} data - The message data
 * @param {CustomWebSocket} ws - The sender's WebSocket connection
 */
async function handleChatMessage(data: ChatMessageData, ws: CustomWebSocket) {
  let playerId = -1;
  if (!(await sqlHandler.doUserExists(data.name))) {
    const passwordHash = await bcrypt.hash(data.password || "");
    await sqlHandler.createUser(data.name, passwordHash);
  }
  playerId = await sqlHandler.getUserByName(data.name);
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
      case CommandEffectType.KILL: {
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
      case CommandEffectType.PRIVATE_MESSAGE: {
        if (!result.effect.target || !players[result.effect.target]) {
          break;
        }

        const targetWs = players[result.effect.target].websocket;

        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: `MP de ${data.name}`,
            message: result.effect.reason,
            role: userRole,
          }));
        }
        break;
      }
      case CommandEffectType.BAN: {
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
      case CommandEffectType.MUTE: {
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
      case CommandEffectType.UNBAN: {
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

      case CommandEffectType.UNMUTE: {
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

      case CommandEffectType.LOGOUT: {
        console.log(
          `Traitement de la commande LOGOUT pour ${result.effect.target}`,
        );

        if (ws && ws.readyState === WebSocket.OPEN) {
          console.log(
            `Envoi du message LOGOUT_COMMAND directement à l'expéditeur`,
          );
          ws.send(JSON.stringify({
            type: MessageTypeEnum.LOGOUT_COMMAND,
            message: "Vous avez été déconnecté.",
          }));

          notifyAll(`${result.effect.target} s'est déconnecté.`, ws);

          setTimeout(() => {
            if (result.effect.target) {
              removePlayer(result.effect.target);
            }
          }, 100);
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
}

/**
 ** Sends a message to all connected clients except the excluded one
 * @param {string} message - The message to send
 * @param {CustomWebSocket} [excludeConnection] - Optional connection to exclude
 */
function notifyAll(message: string, excludeConnection?: CustomWebSocket) {
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
