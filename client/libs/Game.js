import movementManager from "./MovementManager.js";
import sceneManager from "./SceneManager.js";
import { Player } from "./Player.js";
import { GAMESTATE } from "https://localhost:3000/shared/Config.js";
import { getWebSocket, wsState } from "./WebSocketManager.js";
import { MessageTypeEnum } from "https://localhost:3000/shared/MessageTypeEnum.js";
import uiManager from "./UIManager.js";

export class Game {
  constructor() {
    this.players = {};
    GAMESTATE.physics.lastTime = performance.now();

    this.targetFPS = 60;
    this.fixedTimeStep = 1000 / this.targetFPS; // ~16.67ms for 60 FPS
    this.accumulator = 0;
    this.lastFrameTime = performance.now();
    this.running = false;
    
    // Position verification
    this.lastVerifyTime = 0;
    this.verifyInterval = 1000;
    
    // FPS calculation
    this.frameCount = 0;
    this.lastFPSUpdate = performance.now();
    this.fpsUpdateInterval = 1000;
    this.currentFPS = 0;
  }

  update() {
    const currentTime = performance.now();
    let frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    if (frameTime > 200) {
      frameTime = 200;
    }
    
    this.frameCount++;
    if (currentTime - this.lastFPSUpdate >= this.fpsUpdateInterval) {
      this.currentFPS = Math.round(this.frameCount * 1000 / (currentTime - this.lastFPSUpdate));
      uiManager.updateFPS(this.currentFPS);
      
      this.frameCount = 0;
      this.lastFPSUpdate = currentTime;
    }
    
    this.accumulator += frameTime;
    while (this.accumulator >= this.fixedTimeStep) {
      this.fixedUpdate(this.fixedTimeStep / 1000);
      this.accumulator -= this.fixedTimeStep;
    }
    
    this.render();
    
    if (currentTime - this.lastVerifyTime > this.verifyInterval) {
      this.lastVerifyTime = currentTime;
      this.verifyPosition();
    }
    
    if (this.running) {
      requestAnimationFrame(() => this.update());
    }
  }
  
  fixedUpdate(deltaTime) {
    GAMESTATE.physics.lastTime = performance.now();
    movementManager.update(deltaTime);
  }
  
  render() {
    sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.lastFrameTime = performance.now();
      requestAnimationFrame(() => this.update());
    }
  }
  
  stop() {
    this.running = false;
  }

  addNewPlayer(name, position, pitch) {
    // Don't add the local player to the scene
    if (name === localStorage.getItem("username")) {
      return;
    }
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
    
    if (!wsocket || wsocket.readyState !== WebSocket.OPEN || !wsState.isConnected) {
      return;
    }
    
    const positionData = {
      type: MessageTypeEnum.VERIFY_POSITION,
      timestamp: Date.now(),
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
    };
    
    try {
      wsocket.send(JSON.stringify(positionData));
    } catch (error) {
      console.error("Error sending position verification:", error);
    }
  }
}
