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
      this.currentFPS = Math.round(
        this.frameCount * 1000 / (currentTime - this.lastFPSUpdate),
      );
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

    this.checkPositionVerification(currentTime);

    if (this.running) {
      requestAnimationFrame(() => this.update());
    }
  }

  /**
   ** Checks if it's time to send position verification to the server
   * @param {number} currentTime - Current timestamp from performance.now()
   * @returns {void}
   */
  checkPositionVerification(currentTime) {
    if (currentTime - this.lastVerifyTime > this.verifyInterval) {
      this.lastVerifyTime = currentTime;
      this.verifyPosition();
    }
  }

  /**
   ** Updates game physics at fixed time intervals
   * @param {number} deltaTime - The time step in seconds
   * @returns {void}
   */
  fixedUpdate(deltaTime) {
    GAMESTATE.physics.lastTime = performance.now();
    movementManager.update(deltaTime);
  }

  /**
   ** Renders the current game state
   * @returns {void}
   */
  render() {
    sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
  }

  /**
   ** Starts the game loop
   * Initializes the game loop if not already running and sets up the animation frame
   * @returns {void}
   */
  start() {
    if (!this.running) {
      this.running = true;
      this.lastFrameTime = performance.now();
      requestAnimationFrame(() => this.update());
    }
  }

  /**
   ** Stops the game loop
   * @returns {void}
   */
  stop() {
    this.running = false;
  }

  /**
   ** Adds a new player to the game
   * @param {string} name - Player's username
   * @param {Object} position - Player's initial position coordinates
   * @param {number} pitch - Player's camera pitch angle
   * @returns {void}
   */
  addNewPlayer(name, position, pitch) {
    // Don't add the local player to the scene
    if (name === localStorage.getItem("username")) {
      return;
    }
    this.players[name] = new Player(name, position, pitch);
    sceneManager.scene.add(this.players[name].playerGroup);
  }

  /**
   ** Remove a player in the game
   * @param {string} name - Player's username
   * @param {Object} position - Player's initial position coordinates
   * @param {number} pitch - Player's camera pitch angle
   * @returns {void}
   */
  removePlayer(name) {
    // The local player is not in the scene, so we don't need to remove it
    if (this.players[name] == null) {
      return;
    }
    sceneManager.scene.remove(this.players[name].playerGroup);
    delete this.players[name];
  }

  /**
   ** Updates the position of a player
   * @param {string} name - Player's username
   * @param {Object} position - Player's new position coordinates
   * @param {Object} rotation - Player's new rotation coordinates
   * @param {number} pitch - Player's camera pitch angle
   * @returns {void}
   */
  updatePlayerPosition(name, position, rotation, pitch) {
    if (this.players[name] == null) {
      this.addNewPlayer(name, position, pitch);
      return;
    }
    this.players[name].updatePosition(position, rotation, pitch);
  }

  /**
   ** Verifies the player's position and sends it to the server
   * @returns {void}
   */
  verifyPosition() {
    const wsocket = getWebSocket();

    if (
      !wsocket || wsocket.readyState !== WebSocket.OPEN || !wsState.isConnected
    ) {
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

const game = new Game();
export default game;
