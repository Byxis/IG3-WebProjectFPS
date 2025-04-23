import { Game } from "./libs/Game.js";
import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { advancedDebugSceneObjects } from "./libs/SceneUtils.js";

localStorage.setItem("username", "player" + Math.floor(Math.random() * 1000));
let networkTimeOffset = 0;

let name = document.getElementById("name");
name.innerHTML = localStorage.getItem("username");

const wsocket = new WebSocket("ws://localhost:3000");
const game = new Game(wsocket);
initiateWebSocketConnection();

function initiateWebSocketConnection() {
  console.log(localStorage.getItem("auth_token"));

  wsocket.onopen = function () {
    console.log("WebSocket connection opened");

    wsocket.send(JSON.stringify({
      type: "ADD_NEW_PLAYER",
      player: {
        name: localStorage.getItem("username"),
        position: {
          x: 0,
          y: 0,
          z: 5,
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0,
        },
        pitch: 0,
      },
    }));
  };

  wsocket.onmessage = function () {
    const message = JSON.parse(event.data);
    console.log("WebSocket message received:", message);
    let player = message.player;

    if (message.type == "NEW_PLAYER") {
      if (game.players[player.name] != null) {
        return;
      }
      game.addNewPlayer(
        player.name,
        player.position,
        player.rotation,
        player.pitch,
      );
    } else if (message.type == "REMOVE_PLAYER") {
      game.removePlayer(player.name);
    } else if (message.type == "UPDATE_PLAYER_POSITION") {
      game.updatePlayerPosition(
        player.name,
        player.position,
        player.rotation,
        player.pitch,
      );
    } else if (message.type == "POSITION_CORRECTION") {
      const correctedPosition = message.position;

      game.sceneManager.cameraContainer.position.x = correctedPosition.x;
      game.sceneManager.cameraContainer.position.y = correctedPosition.y;
      game.sceneManager.cameraContainer.position.z = correctedPosition.z;

      //GAMESTATE.camera.targetPitch = correctedPitch;

      console.log("Position corrigée par le serveur");
    }
  };

  wsocket.onclose = function () {
    console.log("WebSocket connection closed");
    wsocket.send(JSON.stringify({
      type: "DISCONNECT",
      name: localStorage.getItem("username"),
    }));
  };

  wsocket.onerror = function () {
    console.error("WebSocket error:", error);
  };
}

export function getWebSocket() {
  return wsocket;
}

async function synchronizeClockWithServer() {
  const samples = [];
  for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const response = await fetch('/api/sync');
      const end = Date.now();
      const serverTime = await response.json();
      
      const rtt = end - start;
      samples.push({
          offset: (serverTime - start - (rtt / 2)),
          rtt: rtt
      });
      await new Promise(resolve => setTimeout(resolve, 100));
  }

  samples.sort((a, b) => a.rtt - b.rtt);
  networkTimeOffset = samples[0].offset;
  console.log(`Synchronisé avec le serveur. Offset: ${networkTimeOffset}ms`);
}

function getNetworkTime() {
  return Date.now() + networkTimeOffset;
}

game.start();
synchronizeClockWithServer();
advancedDebugSceneObjects(game.sceneManager.scene);
