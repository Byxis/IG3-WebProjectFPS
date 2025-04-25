import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import { simulatePlayerMovement } from "http://localhost:3000/shared/Physics.js";
import { Vector3 as SharedVector3 } from "http://localhost:3000/shared/Class.js";
import { getNetworkTimeOffset } from "../script.js";

export class MovementManager {
  constructor(sceneManager, wsocket) {
    this.sceneManager = sceneManager;
    this.moveDirection = new SharedVector3();
    this.sideDirection = new SharedVector3();
    this.targetVelocity = new SharedVector3();
    this.wsocket = wsocket;

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
        x: this.sceneManager.cameraContainer.position.x,
        y: this.sceneManager.cameraContainer.position.y,
        z: this.sceneManager.cameraContainer.position.z
      },
      rotation: {
        x: 0,
        y: this.sceneManager.cameraContainer.rotation.y,
        z: 0
      },
      pitch: GAMESTATE.camera.pitch,
      velocity: {
        x: GAMESTATE.physics.velocity.x,
        y: 0,
        z: GAMESTATE.physics.velocity.z
      },
      verticalVelocity: GAMESTATE.physics.verticalVelocity,
      isJumping: GAMESTATE.physics.isJumping,
      movement: {
        forward: 0,
        side: 0,
        isSprinting: false,
        isJumping: false
      }
    };

    this.updateMovementKeybinds();
    this.setupShootingControls();
  }

  update(deltaTime) {
    if (!deltaTime) return;

    this.handleMovementUpdate();
    this.simulateMovement(deltaTime);
    
    document.getElementById("coords").innerText = 
      `X: ${this.sceneManager.cameraContainer.position.x.toFixed(4)} 
      Y: ${this.sceneManager.cameraContainer.position.y.toFixed(4)} 
      Z: ${this.sceneManager.cameraContainer.position.z.toFixed(4)}`;

    const fps = Math.round(1 / deltaTime);
    document.getElementById("fps").innerText = `FPS: ${fps}`;
    
    this.smoothRotation(deltaTime);
  }

  simulateMovement(deltaTime) {
    // Update player state with current values
    this.playerState.position.x = this.sceneManager.cameraContainer.position.x;
    this.playerState.position.y = this.sceneManager.cameraContainer.position.y;
    this.playerState.position.z = this.sceneManager.cameraContainer.position.z;

    this.playerState.rotation.y = this.sceneManager.cameraContainer.rotation.y;
    this.playerState.pitch = GAMESTATE.camera.pitch;

    // Update movement state
    this.playerState.movement = {
      forward: this.forward,
      side: this.side,
      isSprinting: this.isSprinting,
      isJumping: this.isJumping
    };

    // Use shared movement logic
    const newState = simulatePlayerMovement(this.playerState, deltaTime);    
    
    // Apply the new position from the returned state
    this.sceneManager.cameraContainer.position.set(
      newState.position.x,
      newState.position.y,
      newState.position.z
    );
    GAMESTATE.physics.velocity.set(
      newState.velocity.x,
      newState.velocity.y,
      newState.velocity.z
    );

    // Update vertical states
    GAMESTATE.physics.verticalVelocity = newState.verticalVelocity;
    GAMESTATE.physics.isJumping = newState.isJumping;

    // Keep our local state updated with the simulation results
    this.playerState = newState;
  }

  handleMovementUpdate() {
    let oldForward = this.forward;
    let oldSide = this.side;
    let oldIsSprinting = this.isSprinting;
    let oldIsJumping = this.isJumping;
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

    this.isSprinting = GAMESTATE.keyStates.ShiftLeft
    this.isJumping = GAMESTATE.keyStates.Space && !GAMESTATE.physics.isJumping;

    if (
      this.forward !== oldForward ||
      this.side !== oldSide ||
      this.isSprinting !== oldIsSprinting ||
      this.isJumping !== oldIsJumping
    ) {
      this.updateMovementKeybinds();
    }
    else if (this.sceneManager.getPitchHasChanged())
    {
      //* Maybe we should set a timer to send the pitch update,
      //* so we don't spam the server with updates
      this.updateMovementKeybinds();
      this.sceneManager.setPitchHasChanged(false);
    }
  }

  smoothRotation(deltaTime) {
    // Smooth camera rotation
    GAMESTATE.camera.pitch = THREE.MathUtils.lerp(
      GAMESTATE.camera.pitch,
      GAMESTATE.camera.targetPitch,
        CONFIG.ROTATION_LERP
    );
    if (Math.abs(this.sceneManager.camera.rotation.x - GAMESTATE.camera.pitch) > 0.000001) {
      this.sceneManager.setPitchHasChanged(true);
    }

    // Apply camera rotation
    this.sceneManager.camera.rotation.x = GAMESTATE.camera.pitch;

    

    // Smooth camera rotation
    this.sceneManager.cameraContainer.rotation.y = THREE.MathUtils.lerp(
        this.sceneManager.cameraContainer.rotation.y,
        GAMESTATE.camera.targetRotationY,
        CONFIG.ROTATION_LERP
    );
  }

  updateMovementKeybinds() {
    if (this.wsocket == null) return;
    if (this.wsocket.readyState !== 1) {
      console.log(`Socket not ready, retrying in ${this.socketRetryInterval} ms`);
      this.socketRetries++;
      if (this.socketRetries > this.maxSocketRetries) {
        console.log("Max socket retries reached, stopping movement updates");
        this.socketRetries = 0;
      }
      else
      {
        setTimeout(() => this.updateMovementKeybinds(), this.socketRetryInterval);
      }
      return;
    }
    const networkTimeOffset = getNetworkTimeOffset();

    this.wsocket.send(JSON.stringify({
      type: "UPDATE_PLAYER_KEYBINDS",
      name: localStorage.getItem("username"),
      networkTimeOffset: networkTimeOffset,
      movement: {
        forward: this.forward,
        side: this.side,
        isSprinting: this.isSprinting,
        isJumping: this.isJumping,
        rotation: {
          x: this.sceneManager.cameraContainer.rotation.x,
          y: this.sceneManager.cameraContainer.rotation.y,
          z: this.sceneManager.cameraContainer.rotation.z,
        },
        pitch: GAMESTATE.camera.pitch,
      },
    }));
  }

  setupShootingControls() {
    document.addEventListener("click", (event) => {
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

    const cameraPosition = this.sceneManager.camera.getWorldPosition(
      new THREE.Vector3(),
    );
    const cameraDirection = new THREE.Vector3();
    this.sceneManager.camera.getWorldDirection(cameraDirection);

    this.raycaster.set(cameraPosition, cameraDirection);

    const scene = this.sceneManager.scene;
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

        this.wsocket.send(JSON.stringify({
          type: "PLAYER_SHOT",
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
