import { CONFIG } from "../../shared/Config.ts";

const players = {};

export function initiateNewPlayer(data, connections) {
  const player = {
    name: data.player.name,
    health: CONFIG.STARTING_LIVES,
    ammo: CONFIG.STARTING_AMMO,
    kills: 0, // TODO: get from database if found
    killStreak: 0,
    deaths: 0, // TODO: get from database if found
    position: data.player.position,
    rotation: data.player.rotation,
    pitch: data.player.pitch,
  };
  players[data.player.name] = player;

  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "NEW_PLAYER",
        player: player,
      },
    ));
  });
}

export function updatePlayer(data, connections) {
  console.log(JSON.stringify(
    {
      type: "UPDATE_PLAYER",
      player: data.player,
    },
  ));

  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "UPDATE_PLAYER",
        player: data.player,
      },
    ));
  });
}

export function removePlayer(data, connections) {
  console.log(JSON.stringify(
    {
      type: "REMOVE_PLAYER",
      player: data.player,
    },
  ));

  connections.forEach((ws) => {
    ws.send(JSON.stringify(
      {
        type: "REMOVE_PLAYER",
        player: data.player,
      },
    ));
  });
}
