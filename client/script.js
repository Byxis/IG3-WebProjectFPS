import { Game } from "./libs/Game.js";
import uiManager from "./libs/UIManager.js";
import sceneManager from "./libs/SceneManager.js";
import { MessageTypeEnum } from "http://localhost:3000/shared/MessageTypeEnum.js";

localStorage.setItem("username", "player" + Math.floor(Math.random() * 1000));
let networkTimeOffset = 0;

const name = document.getElementById("name");
name.innerHTML = localStorage.getItem("username");

const wsocket = new WebSocket("ws://localhost:3000");
initiateWebSocketConnection();

export function getWebSocket() {
  return wsocket;
}

const game = new Game(wsocket);

function initiateWebSocketConnection() {
  console.log(localStorage.getItem("auth_token"));

  wsocket.onopen = function () {
    console.log("WebSocket connection opened");

    wsocket.send(JSON.stringify({
      type: MessageTypeEnum.ADD_NEW_PLAYER,
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

    wsocket.send(JSON.stringify({
      type: MessageTypeEnum.GET_CHAT_MESSAGES,
    }));
  };

  wsocket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    const player = data.player;

    switch (data.type) {
      case MessageTypeEnum.NEW_PLAYER: {
        if (game.players[player.name] != null) {
          return;
        }
        game.addNewPlayer(
          player.name,
          player.position,
          player.pitch,
        );
        break;
      }

      case MessageTypeEnum.REMOVE_PLAYER: {
        game.removePlayer(player.name);
        break;
      }

      case MessageTypeEnum.UPDATE_PLAYER: {
        game.updatePlayerPosition(
          player.name,
          player.position,
          player.rotation,
          player.pitch,
        );
        break;
      }

      case MessageTypeEnum.POSITION_CORRECTION: {
        const correctedPosition = data.position;
        sceneManager.cameraContainer.position.x = correctedPosition.x;
        sceneManager.cameraContainer.position.y = correctedPosition.y;
        sceneManager.cameraContainer.position.z = correctedPosition.z;
        console.log("Position corrigée par le serveur");
        break;
      }

      case MessageTypeEnum.SEND_CHAT_MESSAGE: {
        const name = data.name;
        const message = data.message;
        const role = data.role;
        uiManager.addNewChatMessage(name, role, message);
        console.log("Received message:", message);
        break;
      }

      case MessageTypeEnum.GET_CHAT_MESSAGES: {
        const messages = data.messages;
        messages.forEach((message) => {
          uiManager.addNewChatMessage(
            message.name,
            message.role,
            message.message,
          );
        });
        break;
      }

      default: {
        console.log("Message type non géré:", data.type);
        break;
      }
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
