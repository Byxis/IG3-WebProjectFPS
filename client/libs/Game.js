import movementManager from "./MovementManager.js";
import sceneManager from "./SceneManager.js";
import { Player } from "./Player.js";
import { GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import { MessageTypeEnum } from "http://localhost:3000/shared/MessageTypeEnum.js";

export class Game {
  constructor() {
    this.players = {};
    GAMESTATE.physics.lastTime = performance.now();

    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS; // ~16.67ms
    this.lastFrameTime = 0;
    this.updateInterval = null;

    this.maxSocketRetries = 10;
    this.socketRetries = 0;
    this.socketRetryInterval = 1000;
  }

  update() {
    // Should be at a fixed rate of 60 FPS, but the actual FPS may vary
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;

    this.lastUpdateTime = currentTime;

    GAMESTATE.physics.lastTime = currentTime;

    movementManager.update(deltaTime);
    sceneManager.renderer.render(
      sceneManager.scene,
      sceneManager.camera,
    );
  }

  start() {
    this.updateInterval = setInterval(() => this.update(), this.frameInterval);
    this.verifyPosition();
  }

  addNewPlayer(name, position, pitch) {
    // Don't add the local player to the scene
    if (name == localStorage.getItem("username")) {
      return;
    }
    console.log("Adding new player:", name);
    this.players[name] = new Player(name, position, pitch);
    sceneManager.scene.add(this.players[name].playerGroup);
  }

  removePlayer(name) {
    // The local player is not in the scene, so we don't need to remove it
    if (this.players[name] == null) {
      return;
    }
    sceneManager.scene.remove(this.players[name].playerGroup);
    delete this.players[name];
  }

  updatePlayerPosition(name, position, rotation, pitch) {
    if (this.players[name] == null) {
      this.addNewPlayer(name, position, pitch);
      return;
    }
    this.players[name].updatePosition(position, rotation, pitch);
  }

  verifyPosition() {
    const wsocket = getWebSocket();
    if (wsocket == null) {
      return;
    }

    if (wsocket.readyState !== 1) {
      console.log(
        `Socket not ready, retrying in ${this.socketRetryInterval} ms`,
      );
      this.socketRetries++;
      if (this.socketRetries > this.maxSocketRetries) {
        console.log("Max socket retries reached, stopping movement updates");
        this.socketRetries = 0;
      } else {
        setTimeout(() => this.verifyPosition(), this.socketRetryInterval);
      }
      return;
    }

    // Verify the player's position
    wsocket.send(JSON.stringify({
      type: MessageTypeEnum.VERIFY_POSITION,
      player: {
        name: localStorage.getItem("username"),
        position: {
          x: sceneManager.cameraContainer.position.x,
          y: sceneManager.cameraContainer.position.y,
          z: sceneManager.cameraContainer.position.z,
        },
        rotation: {
          x: sceneManager.cameraContainer.rotation.x,
          y: sceneManager.cameraContainer.rotation.y,
          z: sceneManager.cameraContainer.rotation.z,
        },
        pitch: GAMESTATE.camera.pitch,
      },
    }));

    setTimeout(() => this.verifyPosition(), 1000);
  }
}
