import { CONFIG } from "../../shared/Config.ts";
import { connectionManager } from "./ConnectionManager.ts";
import sqlHandler from "./SqlHandler.ts";
import { RoleLevel } from "../enums/RoleLevel.ts";
import { MessageTypeEnum } from "../../shared/MessageTypeEnum.ts";
import { matchManager } from "./MatchManager.ts";

export { RoleLevel };

export const players: {
  [name: string]: {
    name: string;
    health: number;
    kills: number;
    killStreak: number;
    deaths: number;
    headshots: number;
    bodyshots: number;
    missedshots: number;
    ammo: number;
    isReloading: boolean;
    reloadTimeout: number | null;
    websocket: WebSocket;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    pitch: number;
    velocity: { x: number; y: number; z: number };
    verticalVelocity: number;
    isJumping: boolean;
    isDead: boolean;
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
    health: CONFIG.STARTING_HEALTH,
    kills: stats.kills,
    killStreak: 0,
    deaths: stats.deaths,
    headshots: stats.headshots,
    bodyshots: stats.bodyshots,
    missedshots: stats.missedshots,
    ammo: CONFIG.STARTING_AMMO,
    isReloading: false,
    reloadTimeout: null,
    websocket: websocket,
    position: { ...dataPlayer.position },
    rotation: { ...dataPlayer.rotation },
    pitch: dataPlayer.pitch,
    velocity: { x: 0, y: 0, z: 5 },
    verticalVelocity: 0,
    isJumping: false,
    isDead: false,
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

  for (const playerName in players) {
    if (playerName !== dataPlayer.name) {
      connectionManager.broadcast({
        type: "NEW_PLAYER",
        player: getPlayerSendInfo(playerName),
      });
    }
  }

  connectionManager.sendToConnection(dataPlayer.name, {
    type: MessageTypeEnum.HEALTH_UPDATE,
    health: player.health,
  });

  connectionManager.sendToConnection(dataPlayer.name, {
    type: MessageTypeEnum.AMMO_UPDATE,
    ammo: player.ammo,
    maxAmmo: CONFIG.MAX_AMMO
  });

  matchManager.playerJoined();
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

  matchManager.playerDisconnected(playerName);
  
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

/**
 ** Applies damage to a player and handles death if needed
 * @param {string} playerName - Name of player to damage
 * @param {number} damage - Amount of damage to apply
 * @param {string} shooterName - Name of the player who caused the damage
 * @returns {boolean} True if player was killed, false otherwise
 */
export function damagePlayer(playerName: string, damage: number, shooterName: string): boolean {
  if (!players[playerName]) return false;

  if (players[playerName].isDead) return false;

  players[playerName].health -= damage;

  if (players[playerName].health < 0) {
    players[playerName].health = 0;
  }

  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.HEALTH_UPDATE,
    health: players[playerName].health,
  });

  if (players[playerName].health <= 0) {
    handlePlayerDeath(playerName, shooterName);
    return true;
  }

  return false;
}

/**
 ** Handles player death, updates stats, and broadcasts event
 * @param {string} playerName - Name of player who died
 * @param {string} killerName - Name of player who killed them
 */
function handlePlayerDeath(playerName: string, killerName: string): void {
  if (killerName && players[killerName] && playerName !== killerName) {
    players[killerName].kills++;
    players[killerName].killStreak++;
  
    matchManager.updatePlayerMatchStats(killerName, { kills: 1 });
  }

  if (players[playerName]) {
    players[playerName].deaths++;
    players[playerName].killStreak = 0;
    players[playerName].isDead = true;
    matchManager.updatePlayerMatchStats(playerName, { deaths: 1 });
  }

  connectionManager.broadcast({
    type: MessageTypeEnum.DEATH_EVENT,
    player: playerName,
    killer: killerName
  });

  if (playerName === killerName) {
    connectionManager.broadcast({
      type: MessageTypeEnum.SEND_CHAT_MESSAGE,
      name: "System",
      message: `${playerName} eliminated themselves`,
      role: 3,
    });
  } else {
    connectionManager.broadcast({
      type: MessageTypeEnum.SEND_CHAT_MESSAGE,
      name: "System",
      message: `${killerName} eliminated ${playerName}`,
      role: 3,
    });
  }

  setTimeout(() => respawnPlayer(playerName), 3000);
}

/**
 ** Respawns a player with full health at spawn position
 * @param {string} playerName - Name of player to respawn
 */
function respawnPlayer(playerName: string): void {
  if (!players[playerName]) return;

  players[playerName].health = CONFIG.STARTING_HEALTH;
  players[playerName].position = { x: 0, y: CONFIG.GROUND_LEVEL, z: 0 }; //TODO: random spawn position
  players[playerName].isDead = false;

  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.HEALTH_UPDATE,
    health: players[playerName].health,
  });

  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.SEND_CHAT_MESSAGE,
    name: "System",
    message: "You have respawned",
    role: 3,
  });

  connectionManager.broadcast({
    type: MessageTypeEnum.RESPAWN_EVENT,
    player: playerName
  });

  updatePlayer(players[playerName]);
}

/**
 ** Decreases player's ammo count after a shot
 * @param {string} playerName - Name of the player who shot
 * @returns {boolean} Whether the shot was allowed (had ammo)
 */
export function decreasePlayerAmmo(playerName: string): boolean {
  if (!players[playerName]) return false;
  if (players[playerName].isReloading || players[playerName].isDead) {
    return false;
  }
  if (players[playerName].ammo <= 0) {
    return false;
  }
  
  players[playerName].ammo--;
  
  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.AMMO_UPDATE,
    ammo: players[playerName].ammo,
    maxAmmo: CONFIG.MAX_AMMO
  });
  
  return true;
}

/**
 ** Starts the reload process for a player
 * @param {string} playerName - Name of the player reloading
 * @returns {boolean} Whether reload was started
 */
export function startReload(playerName: string): boolean {
  if (!players[playerName]) return false;
  
  if (players[playerName].isReloading || 
      players[playerName].isDead || 
      players[playerName].ammo >= CONFIG.MAX_AMMO) {
    return false;
  }
  
  players[playerName].isReloading = true;
  
  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.RELOAD_START,
    reloadTime: CONFIG.RELOAD_TIME
  });
  
  players[playerName].reloadTimeout = setTimeout(() => {
    completeReload(playerName);
  }, CONFIG.RELOAD_TIME);
  
  return true;
}

/**
 ** Completes the reload process for a player
 * @param {string} playerName - Name of the player reloading
 * @returns {boolean} Whether reload was completed successfully
 */
export function completeReload(playerName: string): boolean {
  if (!players[playerName]) return false;
  
  players[playerName].isReloading = false;
  
  if (players[playerName].reloadTimeout !== null) {
    clearTimeout(players[playerName].reloadTimeout);
    players[playerName].reloadTimeout = null;
  }
  
  players[playerName].ammo = CONFIG.MAX_AMMO;
  
  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.RELOAD_COMPLETE
  });
  
  connectionManager.sendToConnection(playerName, {
    type: MessageTypeEnum.AMMO_UPDATE,
    ammo: players[playerName].ammo,
    maxAmmo: CONFIG.MAX_AMMO
  });
  
  return true;
}

/**
 ** Cancels an in-progress reload
 * @param {string} playerName - Name of the player
 * @returns {boolean} Whether reload was successfully canceled
 */
export function cancelReload(playerName: string): boolean {
  if (!players[playerName] || !players[playerName].isReloading) return false;
  
  players[playerName].isReloading = false;
  
  if (players[playerName].reloadTimeout !== null) {
    clearTimeout(players[playerName].reloadTimeout);
    players[playerName].reloadTimeout = null;
  }
  
  return true;
}

/**
 ** Validates a shot and applies damage if valid
 * @param {string} shooter - Name of player who shot
 * @param {string} target - Name of player who was hit
 * @param {number} distance - Distance of the shot
 * @returns {boolean} Whether the shot was valid
 */
export function validateShot(
  shooter: string,
  target: string,
  distance: number,
): boolean {
  if (!players[shooter] || !players[target]) return false;
  
  if (players[shooter].ammo <= 0 || players[shooter].isReloading) {
    return false;
  }
  
  if (!matchManager.canRegisterActions(shooter)) {
    return false;
  }
  
  if (!decreasePlayerAmmo(shooter)) {
    return false;
  }

  let damage = CONFIG.BASE_DAMAGE;
  if (distance > CONFIG.DAMAGE_FALLOFF_START) {
    const falloffRange = CONFIG.DAMAGE_FALLOFF_END - CONFIG.DAMAGE_FALLOFF_START;
    const falloffAmount = Math.min(distance - CONFIG.DAMAGE_FALLOFF_START, falloffRange) / falloffRange;
    const damageMultiplier = 1 - (falloffAmount * (1 - CONFIG.MIN_DAMAGE_PERCENT));
    damage = Math.floor(damage * damageMultiplier);
  }

  const killed = damagePlayer(target, damage, shooter);

  players[shooter].bodyshots++;
  
  matchManager.updatePlayerMatchStats(shooter, { bodyshots: 1 });
  return true;
}
