import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "https://localhost:3000/shared/Config.js";
import { simulatePlayerMovement } from "https://localhost:3000/shared/Physics.js";
import { getWebSocket, wsState } from "./WebSocketManager.js";
import { getNetworkTimeOffset } from "./NetworkSynchronizer.js";
import sceneManager from "./SceneManager.js";
import uiManager from "./UIManager.js";
import { MessageTypeEnum } from "https://localhost:3000/shared/MessageTypeEnum.js";

export class MovementManager {
  /**
   ** Initializes the movement manager with necessary components for player movement and shooting.
   * Sets up raycaster, movement state tracking, and networking verification timers.
   */
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.shootCooldown = 250;
    this.lastShootTime = 0;

    this.forward = 0;
    this.side = 0;
    this.isJumping = false;

    // WebSocket retry mechanism
    this.maxSocketRetries = 10;

    // Verification timer for rare position sync
    this.lastVerificationTime = 0;
    this.verificationInterval = 2000; // Every 2 seconds is enough for safety checks

    // Player state
    this.playerState = {
      position: {
        x: sceneManager.cameraContainer.position.x,
        y: sceneManager.cameraContainer.position.y,
        z: sceneManager.cameraContainer.position.z,
      },
      rotation: {
        x: 0,
        y: sceneManager.cameraContainer.rotation.y,
        z: 0,
      },
      pitch: GAMESTATE.camera.pitch,
      velocity: {
        x: GAMESTATE.physics.velocity.x,
        y: 0,
        z: GAMESTATE.physics.velocity.z,
      },
      verticalVelocity: GAMESTATE.physics.verticalVelocity,
      isJumping: GAMESTATE.physics.isJumping,
      movement: {
        forward: 0,
        side: 0,
        isSprinting: false,
        isJumping: false,
      },
    };

    this.ammo = 0; // Will be set by server
    this.maxAmmo = CONFIG.MAX_AMMO;
    this.isReloading = false;
    this.reloadStartTime = 0;
    this.reloadDuration = CONFIG.RELOAD_TIME;

    this.setupShootingControls();
    this.setupReloadControls();
  }

  /**
   ** Updates the player's movement and rotation for the current frame.
   * @param {number} deltaTime - The time elapsed since the last frame in seconds.
   * @returns {void}
   */
  update(deltaTime) {
    if (!deltaTime) return;

    this.handleMovementUpdate();
    this.simulateMovement(deltaTime);
    this.checkForVerification();
    this.checkForReload();

    uiManager.updatePosition(sceneManager.cameraContainer.position);

    this.smoothRotation(deltaTime);

    if (this.isReloading) {
      const progress = Math.min(
        (performance.now() - this.reloadStartTime) / this.reloadDuration,
        1,
      );
      uiManager.updateReloadProgress(progress);
    }
  }

  /**
   ** Simulates player movement physics based on current input and state.
   * Applies player movement calculations and updates the player's position, velocity and state.
   * @param {number} deltaTime - The time elapsed since the last frame in seconds.
   * @returns {void}
   */
  simulateMovement(deltaTime) {
    this.playerState.position.x = sceneManager.cameraContainer.position.x;
    this.playerState.position.y = sceneManager.cameraContainer.position.y;
    this.playerState.position.z = sceneManager.cameraContainer.position.z;

    this.playerState.rotation.y = sceneManager.cameraContainer.rotation.y;
    this.playerState.pitch = GAMESTATE.camera.pitch;

    this.playerState.movement = {
      forward: this.forward,
      side: this.side,
      isSprinting: this.isSprinting,
      isJumping: this.isJumping,
    };

    const newState = simulatePlayerMovement(this.playerState, deltaTime);

    sceneManager.cameraContainer.position.set(
      newState.position.x,
      newState.position.y,
      newState.position.z,
    );
    GAMESTATE.physics.velocity.set(
      newState.velocity.x,
      newState.velocity.y,
      newState.velocity.z,
    );

    GAMESTATE.physics.verticalVelocity = newState.verticalVelocity;
    GAMESTATE.physics.isJumping = newState.isJumping;

    this.playerState = newState;
  }

  /**
   ** Processes player input and updates movement direction values.
   * Handles keyboard input for movement (WASD/arrows), sprinting, and jumping.
   * Normalizes diagonal movement and triggers network updates when input changes.
   * @returns {void}
   */
  handleMovementUpdate() {
    const oldForward = this.forward;
    const oldSide = this.side;
    const oldIsSprinting = this.isSprinting;
    const oldIsJumping = this.isJumping;
    this.forward = 0;
    this.side = 0;

    // Handle movement input from the player (WASD or arrow keys)
    if (GAMESTATE.keyStates.KeyW || GAMESTATE.keyStates.ArrowUp) {
      this.forward += 1;
    }
    if (GAMESTATE.keyStates.KeyS || GAMESTATE.keyStates.ArrowDown) {
      this.forward -= 1;
    }
    if (GAMESTATE.keyStates.KeyD || GAMESTATE.keyStates.ArrowRight) {
      this.side -= 1;
    }
    if (GAMESTATE.keyStates.KeyA || GAMESTATE.keyStates.ArrowLeft) {
      this.side += 1;
    }

    // Normalize the movement vector to prevent faster diagonal movement
    if (this.forward !== 0 || this.side !== 0) {
      const length = Math.sqrt(
        this.forward * this.forward + this.side * this.side,
      );
      this.forward /= length;
      this.side /= length;
    }

    this.isSprinting = GAMESTATE.keyStates.ShiftLeft;
    this.isJumping = GAMESTATE.keyStates.Space && !GAMESTATE.physics.isJumping;

    if (
      this.forward !== oldForward ||
      this.side !== oldSide ||
      this.isSprinting !== oldIsSprinting ||
      this.isJumping !== oldIsJumping
    ) {
      this.updateMovementKeybinds();
    } else if (sceneManager.getPitchHasChanged()) {
      this.updateMovementKeybinds();
      sceneManager.setPitchHasChanged(false);
    }
  }

  /**
   ** Applies smooth interpolation to camera rotation.
   * Uses linear interpolation to create smooth camera movement between target and current rotations.
   * @param {number} _deltaTime - The time elapsed since the last frame in seconds.
   * @returns {void}
   */
  smoothRotation(_deltaTime) {
    // Smooth camera rotation
    GAMESTATE.camera.pitch = THREE.MathUtils.lerp(
      GAMESTATE.camera.pitch,
      GAMESTATE.camera.targetPitch,
      CONFIG.ROTATION_LERP,
    );
    if (
      Math.abs(sceneManager.camera.rotation.x - GAMESTATE.camera.pitch) >
        0.000001
    ) {
      sceneManager.setPitchHasChanged(true);
    }

    // Apply camera rotation
    sceneManager.camera.rotation.x = GAMESTATE.camera.pitch;

    // Smooth camera rotation
    sceneManager.cameraContainer.rotation.y = THREE.MathUtils.lerp(
      sceneManager.cameraContainer.rotation.y,
      GAMESTATE.camera.targetRotationY,
      CONFIG.ROTATION_LERP,
    );
  }

  /**
   ** Sends the player's current movement state to the server.
   * Transmits movement direction, sprint/jump status, rotation, and pitch via WebSocket.
   * @returns {void}
   */
  updateMovementKeybinds() {
    const wsocket = getWebSocket();
    if (
      !wsocket || wsocket.readyState !== WebSocket.OPEN || !wsState.isConnected
    ) {
      return;
    }

    const now = Date.now();
    try {
      wsocket.send(JSON.stringify({
        type: MessageTypeEnum.UPDATE_PLAYER_KEYBINDS,
        name: localStorage.getItem("username"),
        timestamp: now,
        networkTimeOffset: getNetworkTimeOffset(),
        movement: {
          forward: this.forward,
          side: this.side,
          isSprinting: this.isSprinting,
          isJumping: this.isJumping,
          rotation: {
            x: sceneManager.cameraContainer.rotation.x,
            y: sceneManager.cameraContainer.rotation.y,
            z: sceneManager.cameraContainer.rotation.z,
          },
          pitch: GAMESTATE.camera.pitch,
        },
      }));
    } catch (error) {
      console.error("Failed to send movement update:", error);
    }
  }

  /**
   ** Periodically sends position verification data to the server.
   * Helps prevent cheating and ensures client-server synchronization at regular intervals.
   * @returns {void}
   */
  checkForVerification() {
    const now = Date.now();
    if (now - this.lastVerificationTime < this.verificationInterval) {
      return;
    }

    this.lastVerificationTime = now;

    const wsocket = getWebSocket();
    if (
      !wsocket || wsocket.readyState !== WebSocket.OPEN || !wsState.isConnected
    ) {
      return;
    }

    try {
      wsocket.send(JSON.stringify({
        type: MessageTypeEnum.VERIFY_POSITION,
        name: localStorage.getItem("username"),
        timestamp: now,
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
      }));
    } catch (error) {
      console.error("Failed to send position verification:", error);
    }
  }

  /**
   ** Checks if reload key is pressed and handles reloading
   * @returns {void}
   */
  checkForReload() {
    if (GAMESTATE.keyStates.KeyR && !this.isReloading && this.ammo < this.maxAmmo) {
      this.startReload();
    }
  }

  /**
   ** Starts the reload process
   * @returns {void}
   */
  startReload() {
    if (this.isReloading) return;

    const wsocket = getWebSocket();
    if (!wsocket || wsocket.readyState !== WebSocket.OPEN || !wsState.isConnected) {
      return;
    }

    wsocket.send(JSON.stringify({
      type: MessageTypeEnum.RELOAD_START,
      name: localStorage.getItem("username"),
      timestamp: Date.now(),
    }));
  }

  /**
   ** Sets up event listeners for reload key
   * @returns {void}
   */
  setupReloadControls() {
    document.addEventListener("keydown", (event) => {
      if (event.code === "KeyR") {
        GAMESTATE.keyStates.KeyR = true;
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code === "KeyR") {
        GAMESTATE.keyStates.KeyR = false;
      }
    });
  }

  /**
   ** Sets up event listeners for shooting mechanics.
   * Handles mouse click events for shooting and applies appropriate event filters.
   * @returns {void}
   */
  setupShootingControls() {
    document.addEventListener("click", (event) => {
      if (document.pointerLockElement !== sceneManager.renderer.domElement) {
        return;
      }
      if (
        event.target.tagName === "BUTTON" || event.target.tagName === "INPUT"
      ) {
        return;
      }
      this.shoot();
    });
  }

  /**
   ** Handles the shooting logic when player fires a weapon.
   * Implements cooldown, raycasting for hit detection, and sends hit information to server.
   * @returns {void}
   */
  shoot() {
    console.log("Shot fired");

    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) {
      return;
    }

    if (this.isReloading || this.ammo <= 0) {
      if (this.ammo <= 0) {
        console.log("Out of ammo, auto reloading...");
        this.startReload();
      }
      return;
    }

    this.lastShootTime = now;

    const cameraPosition = sceneManager.camera.getWorldPosition(
      new THREE.Vector3(),
    );
    const cameraDirection = new THREE.Vector3();
    sceneManager.camera.getWorldDirection(cameraDirection);

    this.raycaster.set(cameraPosition, cameraDirection);

    const scene = sceneManager.scene;
    const targets = [];

    scene.traverse((object) => {
      if (
        object.isMesh && object.parent &&
        object.parent.name &&
        object.parent.name !== localStorage.getItem("username")
      ) {
        targets.push(object);
      }
    });

    const wsocket = getWebSocket();
    if (
      wsocket && wsocket.readyState === WebSocket.OPEN &&
      wsState.isConnected
    ) {
      const shotData = {
        type: MessageTypeEnum.PLAYER_SHOT,
        shooter: localStorage.getItem("username"),
        timestamp: Date.now(),
        position: {
          x: cameraPosition.x,
          y: cameraPosition.y,
          z: cameraPosition.z,
        },
        direction: {
          x: cameraDirection.x,
          y: cameraDirection.y,
          z: cameraDirection.z,
        },
      };

      const intersects = this.raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        let hitObject = hit.object;
        let playerGroup = hitObject;
        while (
          playerGroup &&
          (!playerGroup.name || !playerGroup.parent ||
            playerGroup.parent.type !== "Scene")
        ) {
          playerGroup = playerGroup.parent;
        }

        const hitPlayerName = playerGroup ? playerGroup.name : null;

        if (hitPlayerName) {
          console.log(
            `Hit player ${hitPlayerName} at distance ${hit.distance.toFixed(2)}`,
          );

          shotData.target = hitPlayerName;
          shotData.hitPoint = {
            x: hit.point.x,
            y: hit.point.y,
            z: hit.point.z,
          };
          shotData.distance = hit.distance;
        }
      }

      wsocket.send(JSON.stringify(shotData));
    }
  }
}

const movementManager = new MovementManager();
export default movementManager;
