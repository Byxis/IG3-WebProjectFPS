import { CONFIG } from "../../shared/Config.ts";
import { connectionManager } from "./ConnectionManager.ts";
import sqlHandler from "./SqlHandler.ts";
import { RoleLevel } from "../enums/RoleLevel.ts";

export { RoleLevel };

export const players: {
  [name: string]: {
    name: string;
    health: number;
    ammo: number;
    kills: number;
    killStreak: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
    websocket: WebSocket;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    pitch: number;
    velocity: { x: number; y: number; z: number };
    verticalVelocity: number;
    isJumping: boolean;
    lastUpdateTime: number;
    lastUpdateSended: number;
    networkTimeOffset: number;
    movement: {
      forward: number;
      side: number;
      isSprinting: boolean;
      isJumping: boolean;
    };
  };
} = {};

/**
 ** Initializes a new player in the game
 * @param {object} dataPlayer - Player initialization data
 * @param {WebSocket} websocket - Player's WebSocket connection
 */
export async function initiateNewPlayer(dataPlayer: {
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  pitch: number;
}, websocket: WebSocket) {
  const stats = await sqlHandler.getUserStats(dataPlayer.name);
  const player = {
    name: dataPlayer.name,
    health: CONFIG.STARTING_LIVES,
    ammo: CONFIG.STARTING_AMMO,
    kills: stats.kills,
    killStreak: 0,
    deaths: stats.deaths,
    headshots: stats.headshots,
    bodyshots: stats.bodyshots,
    missedshots: stats.missedshots,
    websocket: websocket,
    position: { ...dataPlayer.position },
    rotation: { ...dataPlayer.rotation },
    pitch: dataPlayer.pitch,
    velocity: { x: 0, y: 0, z: 5 },
    verticalVelocity: 0,
    isJumping: false,
    lastUpdateTime: performance.now(),
    lastUpdateSended: performance.now(),
    networkTimeOffset: 0,
    movement: {
      forward: 0,
      side: 0,
      isSprinting: false,
      isJumping: false,
    },
  };
  players[dataPlayer.name] = player;

  connectionManager.broadcast({
    type: "NEW_PLAYER",
    player: getPlayerSendInfo(player.name),
  });

  // Send to the new player all the other players
  for (const playerName in players) {
    if (playerName !== dataPlayer.name) {
      connectionManager.broadcast({
        type: "NEW_PLAYER",
        player: getPlayerSendInfo(playerName),
      });
    }
  }
}

/**
 ** Updates player position for all connected clients
 * @param {object} player - Player data to update
 */
export function updatePlayer(player: {
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  pitch: number;
}) {
  connectionManager.broadcast({
    type: "UPDATE_PLAYER",
    player: getPlayerSendInfo(player.name),
  });
}

/**
 ** Removes a player from the game
 * @param {string} playerName - Name of the player to remove
 */
export function removePlayer(playerName: string) {
  connectionManager.broadcast({
    type: "REMOVE_PLAYER",
    player: {
      name: playerName,
    },
  });

  delete players[playerName];
}

/**
 ** Gets player info formatted for network transmission
 * @param {string} name - Player name
 * @returns {object|null} Player info or null if not found
 */
function getPlayerSendInfo(name: string) {
  if (players[name]) {
    return {
      name: players[name].name,
      position: players[name].position,
      rotation: players[name].rotation,
      pitch: players[name].pitch,
    };
  }
  return null;
}

/**
 ** Checks if a player exists
 * @param {string} name - Player name to check
 * @returns {boolean} Whether the player exists
 */
export function playerExists(name: string): boolean {
  return players[name] !== undefined;
}
