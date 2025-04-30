import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { simulatePlayerMovement } from "http://localhost:3000/shared/Physics.js";
import { Vector3 as SharedVector3 } from "http://localhost:3000/shared/Class.js";
import { getNetworkTimeOffset, getWebSocket } from "../script.js";
import sceneManager from "./SceneManager.js";
import { MessageTypeEnum } from "http://localhost:3000/shared/MessageTypeEnum.js";

export class MovementManager {
  constructor() {
    this.moveDirection = new SharedVector3();
    this.sideDirection = new SharedVector3();
    this.targetVelocity = new SharedVector3();

    this.raycaster = new THREE.Raycaster();
    this.shootCooldown = 500;
    this.lastShootTime = 0;

    this.forward = 0;
    this.side = 0;
    this.isJumping = false;

    this.maxSocketRetries = 10;
    this.socketRetries = 0;
    this.socketRetryInterval = 1000;

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

    this.setupShootingControls();
  }

  update(deltaTime) {
    if (!deltaTime) return;

    this.handleMovementUpdate();
    this.simulateMovement(deltaTime);

    document.getElementById("coords").innerText = `X: ${
      sceneManager.cameraContainer.position.x.toFixed(4)
    } 
      Y: ${sceneManager.cameraContainer.position.y.toFixed(4)} 
      Z: ${sceneManager.cameraContainer.position.z.toFixed(4)}`;

    const fps = Math.round(1 / deltaTime);
    document.getElementById("fps").innerText = `FPS: ${fps}`;

    this.smoothRotation(deltaTime);
  }

  simulateMovement(deltaTime) {
    // Update player state with current values
    this.playerState.position.x = sceneManager.cameraContainer.position.x;
    this.playerState.position.y = sceneManager.cameraContainer.position.y;
    this.playerState.position.z = sceneManager.cameraContainer.position.z;

    this.playerState.rotation.y = sceneManager.cameraContainer.rotation.y;
    this.playerState.pitch = GAMESTATE.camera.pitch;

    // Update movement state
    this.playerState.movement = {
      forward: this.forward,
      side: this.side,
      isSprinting: this.isSprinting,
      isJumping: this.isJumping,
    };

    // Use shared movement logic
    const newState = simulatePlayerMovement(this.playerState, deltaTime);

    // Apply the new position from the returned state
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

    // Update vertical states
    GAMESTATE.physics.verticalVelocity = newState.verticalVelocity;
    GAMESTATE.physics.isJumping = newState.isJumping;

    // Keep our local state updated with the simulation results
    this.playerState = newState;
  }

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
      //* Maybe we should set a timer to send the pitch update,
      //* so we don't spam the server with updates
      this.updateMovementKeybinds();
      sceneManager.setPitchHasChanged(false);
    }
  }

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

  updateMovementKeybinds() {
    const wsocket = getWebSocket();
    if (wsocket == null) return;
    if (wsocket.readyState !== 1) {
      console.log(
        `Socket not ready, retrying in ${this.socketRetryInterval} ms`,
      );
      this.socketRetries++;
      if (this.socketRetries > this.maxSocketRetries) {
        console.log("Max socket retries reached, stopping movement updates");
        this.socketRetries = 0;
      } else {
        setTimeout(
          () => this.updateMovementKeybinds(),
          this.socketRetryInterval,
        );
      }
      return;
    }
    const networkTimeOffset = getNetworkTimeOffset();

    wsocket.send(JSON.stringify({
      type: MessageTypeEnum.UPDATE_PLAYER_KEYBINDS,
      name: localStorage.getItem("username"),
      networkTimeOffset: networkTimeOffset,
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
  }

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

  shoot() {
    console.log("Shot !");

    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) {
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
        object.isMesh && object.parent && object.parent.name &&
        object.parent.name !== localStorage.getItem("username")
      ) {
        targets.push(object);
      }
    });

    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      let hitObject = hit.object;

      while (hitObject.parent && !hitObject.parent.name) {
        hitObject = hitObject.parent;
      }

      const hitPlayerName = hitObject.parent.name;
      console.log(hitPlayerName);

      if (hitPlayerName) {
        console.log(
          `Joueur touché: ${hitPlayerName} à une distance de ${
            hit.distance.toFixed(2)
          }`,
        );

        getWebSocket().send(JSON.stringify({
          type: MessageTypeEnum.PLAYER_SHOT,
          shooter: localStorage.getItem("username"),
          target: hitPlayerName,
          hitPoint: {
            x: hit.point.x,
            y: hit.point.y,
            z: hit.point.z,
          },
        }));
      }
    }
  }
}

const movementManager = new MovementManager();
export default movementManager;
