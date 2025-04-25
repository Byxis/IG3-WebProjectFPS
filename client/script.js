import { Game } from "./libs/Game.js";

localStorage.setItem("username", "player" + Math.floor(Math.random() * 1000));
let networkTimeOffset = 0;

const name = document.getElementById("name");
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
    const player = message.player;

    if (message.type == "NEW_PLAYER") {
      if (game.players[player.name] != null) {
        return;
      }

      game.addNewPlayer(
        player.name,
        player.position,
        player.pitch,
      );
    } else if (message.type == "REMOVE_PLAYER") {
      game.removePlayer(player.name);
    } else if (message.type == "UPDATE_PLAYER") {
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
      console.log("Position corrigée par le serveur");
    }
  };

  globalThis.onbeforeunload = function () {
    if (wsocket.readyState === WebSocket.OPEN) {
      wsocket.send(JSON.stringify({
        type: "DISCONNECT",
        name: localStorage.getItem("username"),
      }));
    }
  };

  wsocket.onclose = function () {
    console.log("WebSocket connection closed");
  };

  wsocket.onerror = function () {
    console.error("WebSocket error:", error);
  };
}

export function getWebSocket() {
  return wsocket;
}

function synchronizeClockWithServer(sampleSize = 5) {
  const samples = [];
  let sampleCount = 0;

  function collectSample() {
    const start = Date.now();

    fetch("http://localhost:3000/api/sync", {
      method: "GET",
      mode: "cors",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Synchronization failed");
        }
      })
      .then((serverTime) => {
        const end = Date.now();
        const rtt = end - start;
        let newNetworkTimeOffset = 0;

        samples.push({
          offset: (serverTime - start - (rtt / 2)),
          rtt: rtt,
        });

        sampleCount++;

        if (sampleCount < sampleSize) {
          setTimeout(collectSample, 100);
        } else {
          for (let i = 0; i < sampleSize; i++) {
            newNetworkTimeOffset += samples[i].offset;
          }
          networkTimeOffset = newNetworkTimeOffset / samples.length;
          document.getElementById("net-debug").innerHTML = `
            Offset: ${getNetworkTimeOffset().toFixed(2)}ms
        `;
        }
      })
      .catch((error) => console.error("Error:", error));
  }

  collectSample();
}

export function getNetworkTimeOffset() {
  return networkTimeOffset;
}

game.start();

// Server time synchronization
synchronizeClockWithServer();

// Periodic re-synchronization every minute
setInterval(() => {
  synchronizeClockWithServer(5);
}, 60000);
