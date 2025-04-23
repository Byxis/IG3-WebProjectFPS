import { MovementManager } from "./MovementManager.js";
import { SceneManager } from "./SceneManager.js";
import { Player } from "./Player.js";
import { CONFIG, GAMESTATE } from "http://localhost:3000/shared/Config.js";
import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { getWebSocket } from "../script.js";

export class Game {
  constructor(wsocket) {
    this.players = {};
    this.wsocket = wsocket;
    this.sceneManager = new SceneManager();
    this.movementManager = new MovementManager(this.sceneManager, wsocket);
    this.animate = this.animate.bind(this);
    GAMESTATE.physics.lastTime = performance.now();

    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS; // ~16.67ms
    this.lastFrameTime = 0;
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    if (this.lastFrameTime === 0) this.lastFrameTime = currentTime;
    const elapsed = currentTime - this.lastFrameTime;

    // Update the game state only if enough time has passed
    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

      const deltaTime = elapsed / 1000;
      GAMESTATE.physics.lastTime = currentTime;

      this.movementManager.update(deltaTime);
      this.sceneManager.renderer.render(
        this.sceneManager.scene,
        this.sceneManager.camera,
      );
    }
  }

  start() {
    this.animate(performance.now());
    this.verifyPosition();
  }

  addNewPlayer(name, position, rotation, pitch) {
    // Don't add the local player to the scene
    if (name == localStorage.getItem("username")) {
      return;
    }
    this.players[name] = new Player(name, position, rotation, pitch);
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
      this.addNewPlayer(name, position, rotation, pitch);
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
      console.log("Socket not ready, retrying in 1000ms");
      setTimeout(() => this.verifyPosition(), 1000);
      this.wsocket = getWebSocket();
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

    setTimeout(() => this.verifyPosition(), 166.7);
  }
}
