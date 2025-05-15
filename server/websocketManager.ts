import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { authMiddleware } from "./middleware/authMiddleware.ts";
import {
  initiateNewPlayer,
  players,
  removePlayer,
  validateShot,
  startReload,
} from "./libs/PlayerHandler.ts";
import { ServerPhysics } from "./libs/ServerPhysics.ts";
import { MessageTypeEnum } from "../shared/MessageTypeEnum.ts";
import sqlHandler from "./libs/SqlHandler.ts";
import commandHandler from "./libs/CommandHandler.ts";
import { CommandEffectType } from "./enums/CommandEffectType.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { ErrorType } from "./enums/ErrorType.ts";
import { connectionManager } from "./libs/ConnectionManager.ts";

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
  shooter?: string;
  target?: string;
  distance?: number;
}

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

      const username = ctx.state.user?.username;
      console.log(`WebSocket upgrade request from user: ${username}`);
      
      const ws = ctx.upgrade() as CustomWebSocket;
      
      if (username) {
        connectionManager.addConnection(username, ws);
        console.log(`New authenticated connection for user: ${username}`);
        
        setupWebSocketHandlers(ws, serverPhysics);
      } else {
        ws.close(1008, "Authentication required");
        console.log("Rejected unauthenticated connection attempt");
      }
      
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
      if (ws.username) {
        connectionManager.sendToConnection(ws.username, {
          type: MessageTypeEnum.SEND_CHAT_MESSAGE,
          name: "Système",
          message: `Bienvenue, ${ws.username}! Connection établie.`,
          role: 3,
        });
        console.log(`Welcome message sent to ${ws.username}`);
      }
    } catch (error) {
      console.error("Failed to send welcome message:", error);
    }
  }, 1000);

  ws.onerror = (error) => {
    if (ws.username) {
      connectionManager.removeConnection(ws.username);
    }
    console.error(`WebSocket error for user ${ws.username}:`, error);
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
            if (ws.username) {
              connectionManager.sendToConnection(ws.username, {
                type: MessageTypeEnum.POSITION_CORRECTION,
                position: result.position,
                rotation: result.rotation,
                pitch: result.pitch,
              });
            }
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
          connectionManager.removeConnection(data.name);
          break;
        }

        case MessageTypeEnum.GET_CHAT_MESSAGES: {
          console.log(`Chat messages requested`);
          const matchId = 1; //TODO: get match id from the current match
          const messages = await sqlHandler.getChatMessages(matchId);

          if (messages.length === 0) break;
          if (ws.username) {
            connectionManager.sendToConnection(ws.username, {
              type: MessageTypeEnum.GET_CHAT_MESSAGES,
              messages: messages,
            });
          }
          break;
        }

        case MessageTypeEnum.SEND_CHAT_MESSAGE: {
          handleChatMessage(data, ws);
          break;
        }

        case MessageTypeEnum.PLAYER_SHOT: {
          if (data.target && data.distance) {
            validateShot(data.shooter, data.target, data.distance);
          } else if (players[data.shooter]) {
            if (players[data.shooter].ammo > 0 && !players[data.shooter].isReloading) {
              players[data.shooter].ammo--;
              players[data.shooter].missedshots++;

              connectionManager.sendToConnection(data.shooter, {
                type: MessageTypeEnum.AMMO_UPDATE,
                ammo: players[data.shooter].ammo,
                maxAmmo: CONFIG.MAX_AMMO,
              });
            }
          }
          break;
        }

        case MessageTypeEnum.RELOAD_START: {
          if (data.name) {
            startReload(data.name);
          }
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
    if (ws.username) {
      connectionManager.removeConnection(ws.username);
    }
    console.log(
      `- websocket disconnected for user ${ws.username} (${connectionManager.connectionCount} connections remaining)`,
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

    if (ws.username) {
      connectionManager.sendToConnection(ws.username, {
        type: MessageTypeEnum.SEND_CHAT_MESSAGE,
        name: "Système",
        message: result.message,
        role: 3,
      });
    }

    switch (result.effect.type) {
      case CommandEffectType.KILL: {
        if (!result.effect.target) break;
        if (players[result.effect.target]) {
          players[result.effect.target].health = 0;

          if (result.effect.target === data.name) {
            connectionManager.broadcast({
              type: MessageTypeEnum.SEND_CHAT_MESSAGE,
              name: "Système",
              message: `${data.name} s'est suicidé`,
              role: 3,
            }, ws.username);
          } else {
            connectionManager.broadcast({
              type: MessageTypeEnum.SEND_CHAT_MESSAGE,
              name: "Système",
              message: `${result.effect.target} a été tué par ${data.name}`,
              role: 3,
            }, ws.username);
          }
        }
        break;
      }
      case CommandEffectType.PRIVATE_MESSAGE: {
        if (!result.effect.target || !players[result.effect.target]) {
          break;
        }

        connectionManager.sendToConnection(result.effect.target, {
          type: MessageTypeEnum.SEND_CHAT_MESSAGE,
          name: `MP de ${data.name}`,
          message: result.effect.reason,
          role: userRole,
        });
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
          connectionManager.removeConnection(result.effect.target);
          const durationText = result.effect.expiryDate
            ? `temporairement (jusqu'au ${result.effect.expiryDate.toLocaleString()})`
            : "définitivement";
          connectionManager.broadcast({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: `${result.effect.target} a été banni ${durationText} par ${data.name} pour: ${result.effect.reason}`,
            role: 3,
          }, ws.username);
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
          connectionManager.broadcast({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: `${result.effect.target} a été rendu muet ${durationText} par ${data.name} pour: ${result.effect.reason}`,
            role: 3,
          }, ws.username);
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
          connectionManager.broadcast({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: `${result.effect.target} a été débanni par ${data.name}`,
            role: 3,
          }, ws.username);
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
          connectionManager.broadcast({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: `${result.effect.target} a été démuté par ${data.name}`,
            role: 3,
          }, ws.username);
        }
        break;
      }

      case CommandEffectType.LOGOUT: {
        console.log(
          `Traitement de la commande LOGOUT pour ${result.effect.target}`,
        );

        if (ws.username) {
          connectionManager.sendToConnection(ws.username, {
            type: MessageTypeEnum.LOGOUT_COMMAND,
            message: "Vous avez été déconnecté.",
          });

          connectionManager.broadcast({
            type: MessageTypeEnum.SEND_CHAT_MESSAGE,
            name: "Système",
            message: `${result.effect.target} s'est déconnecté.`,
            role: 3,
          }, ws.username);

          setTimeout(() => {
            if (result.effect.target) {
              removePlayer(result.effect.target);
              connectionManager.removeConnection(result.effect.target);
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
      if (ws.username) {
        connectionManager.sendToConnection(ws.username, {
          type: MessageTypeEnum.SEND_CHAT_MESSAGE,
          name: "Système",
          message:
            `Vous ne pouvez pas envoyer de message car vous êtes muet ${muteStatus.expiry ? `jusqu'au ${muteStatus.expiry.toLocaleString()}` : "définitivement"}. Raison: ${muteStatus.reason}`,
          role: 3,
        });
      }
    } else {
      sqlHandler.addChatMessage(playerId, matchId, data.message);
      connectionManager.broadcast({
        type: MessageTypeEnum.SEND_CHAT_MESSAGE,
        name: data.name,
        message: data.message,
        role: userRole,
      });
    }
  }
}

/**
 ** Sends a message to all connected clients except the excluded one
 * @param {string} message - The message to send
 * @param {CustomWebSocket} [excludeConnection] - Optional connection to exclude
 */
function notifyAll(message: string, excludeConnection?: CustomWebSocket) {
  connectionManager.broadcast({
    type: MessageTypeEnum.SEND_CHAT_MESSAGE,
    name: "Système",
    message: message,
    role: 3,
  }, excludeConnection?.username);
}
