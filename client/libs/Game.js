import { MovementManager } from "./MovementManager.js";
import { SceneManager } from "./SceneManager.js";
import { Player } from "./Player.js";
import { GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import { UIManager } from "./UIManager.js";

export class Game {
  constructor(wsocket) {
    this.players = {};
    this.wsocket = wsocket;
    this.sceneManager = new SceneManager();
    this.movementManager = new MovementManager(this.sceneManager, wsocket);
    this.uimanager = new UIManager(this.sceneManager);
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

    this.movementManager.update(deltaTime);
    this.sceneManager.renderer.render(
      this.sceneManager.scene,
      this.sceneManager.camera,
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
    this.sceneManager.scene.add(this.players[name].playerGroup);
  }

  removePlayer(name) {
    // The local player is not in the scene, so we don't need to remove it
    if (this.players[name] == null) {
      return;
    }
    this.sceneManager.scene.remove(this.players[name].playerGroup);
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
    if (this.wsocket == null) {
      this.wsocket = getWebSocket();
      return;
    }

    if (this.wsocket.readyState !== 1) {
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
    this.wsocket.send(JSON.stringify({
      type: "VERIFY_POSITION",
      player: {
        name: localStorage.getItem("username"),
        position: {
          x: this.sceneManager.cameraContainer.position.x,
          y: this.sceneManager.cameraContainer.position.y,
          z: this.sceneManager.cameraContainer.position.z,
        },
        rotation: {
          x: this.sceneManager.cameraContainer.rotation.x,
          y: this.sceneManager.cameraContainer.rotation.y,
          z: this.sceneManager.cameraContainer.rotation.z,
        },
        pitch: GAMESTATE.camera.pitch,
      },
    }));

    setTimeout(() => this.verifyPosition(), 1000);
  }
}
