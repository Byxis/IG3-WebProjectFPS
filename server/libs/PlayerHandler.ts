import { CONFIG } from "../../shared/Config.ts";
import { connections } from "../back_server.ts";
import sqlHandler from "./SqlHandler.ts";

export enum RoleLevel {
  USER = 1,
  MODERATOR = 2,
  ADMIN = 3
}

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

  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "NEW_PLAYER",
        player: getPlayerSendInfo(player.name),
      },
    ));
  });

  // Send to the new player all the other players
  for (const playerName in players) {
    if (playerName !== dataPlayer.name) {
      websocket.send(JSON.stringify(
        {
          type: "NEW_PLAYER",
          player: getPlayerSendInfo(playerName),
        },
      ));
    }
  }
}

export function updatePlayer(player: {
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  pitch: number;
}) {
  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "UPDATE_PLAYER",
        player: getPlayerSendInfo(player.name),
      },
    ));
  });
}

export function removePlayer(playerName: string) {
  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "REMOVE_PLAYER",
        player: {
          name: playerName,
        },
      },
    ));
  });

  delete players[playerName];
}

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

export function playerExists(name: string): boolean {
  return players[name] !== undefined;
}
