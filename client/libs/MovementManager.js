import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
import { CONFIG, GAMESTATE } from "http://localhost:3000/shared/Config.js";
import { getWebSocket } from "../script.js";
import { simulatePlayerMovement } from "http://localhost:3000/shared/Physics.js";
import { Vector3 as SharedVector3 } from "http://localhost:3000/shared/Class.js";

export class MovementManager {
  constructor(sceneManager, wsocket) {
    this.sceneManager = sceneManager;
    this.moveDirection = new THREE.Vector3();
    this.sideDirection = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    this.wsocket = wsocket;

    // Network optimization properties
    this.lastSentPosition = new THREE.Vector3();
    this.lastSentRotation = new THREE.Euler();
    this.lastSentPitch = 0;
    this.updateInterval = 25;
    this.timeSinceLastUpdate = 0;
    this.positionThreshold = 0.1;
    this.rotationThreshold = 0.01;

    this.raycaster = new THREE.Raycaster();
    this.shootCooldown = 500;
    this.lastShootTime = 0;

    this.forward = 0;
    this.side = 0;
    this.currentSpeed = 0;
    this.isJumping = false;

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
        speed: CONFIG.WALK_SPEED,
        isJumping: false
      }
    };
    //TODO: Remove
    this.dxMax = 0;
    this.dyMax = 0;
    this.dzMax = 0;

    this.updateMovementKeybinds();
    this.setupShootingControls();
  }

  update(deltaTime) {
    if (!deltaTime) return;

    // Handle position correction interpolation if active
    if (this.isInterpolating) {
      this.interpolationTimer += deltaTime;
      const progress = Math.min(this.interpolationTimer / this.interpolationDuration, 1.0);
      
      if (progress < 1.0) {
        // Interpolate position smoothly
        this.sceneManager.cameraContainer.position.lerpVectors(
          this.interpolationStartPos,
          this.interpolationTargetPos,
          progress
        );
      } else {
        // Interpolation complete
        this.isInterpolating = false;
      }
    } else {
      // Normal movement update when not interpolating
      this.handleMovementUpdate();
      this.simulateMovement(deltaTime);
    }
    
    this.smoothRotation(deltaTime);

    // Only check for sending updates periodically
    this.timeSinceLastUpdate += deltaTime * 1000; // Convert to ms
    if (this.timeSinceLastUpdate >= this.updateInterval) {
      this.timeSinceLastUpdate = 0;
    }
  }

  // New method to set up position interpolation
  setPositionInterpolation(startPos, targetPos, durationInSeconds) {
    this.isInterpolating = true;
    this.interpolationStartPos.set(startPos.x, startPos.y, startPos.z);
    this.interpolationTargetPos.set(targetPos.x, targetPos.y, targetPos.z);
    this.interpolationDuration = durationInSeconds;
    this.interpolationTimer = 0;
    
    // Also update player state to avoid an immediate local simulation overriding this
    this.playerState.position.x = startPos.x;
    this.playerState.position.y = startPos.y;
    this.playerState.position.z = startPos.z;
    
    console.log(`Position interpolation started: ${durationInSeconds.toFixed(2)}s from`, 
                startPos, "to", targetPos);
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
      speed: this.currentSpeed,
      isJumping: this.isJumping
    };

    // Use shared movement logic
    const newState = simulatePlayerMovement(this.playerState, deltaTime);

    const dx = newState.position.x - this.playerState.position.x;
    const dy = newState.position.y - this.playerState.position.y;
    const dz = newState.position.z - this.playerState.position.z;
    this.dxMax = Math.max(this.dxMax, Math.abs(dx));
    this.dyMax = Math.max(this.dyMax, Math.abs(dy));
    this.dzMax = Math.max(this.dzMax, Math.abs(dz));
    console.log(
      `Max deltas: dx: ${this.dxMax.toFixed(2)}, dy: ${this.dyMax.toFixed(2)}, dz: ${this.dzMax.toFixed(2)}`
    );

    // Apply the new position from the returned state
    this.sceneManager.cameraContainer.position.set(
      newState.position.x,
      newState.position.y,
      newState.position.z
    );

    // Update THREE.Vector3 velocity in GAMESTATE from the plain object returned
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
    let oldSpeed = this.currentSpeed;
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

    // Handle sprinting
    this.currentSpeed = GAMESTATE.keyStates.ShiftLeft
      ? CONFIG.SPRINT_SPEED
      : CONFIG.WALK_SPEED;

    if (GAMESTATE.keyStates.Space && !GAMESTATE.physics.isJumping) {
      this.isJumping = true;
    } else {
      this.isJumping = false;
    }

    if (
      this.forward !== oldForward ||
      this.side !== oldSide ||
      this.currentSpeed !== oldSpeed ||
      this.isJumping !== oldIsJumping
    ) {
      console.log("Sending movement update");
      this.updateMovementKeybinds();
    }
  }

  smoothRotation(deltaTime) {
    // Smooth camera rotation
    GAMESTATE.camera.pitch = THREE.MathUtils.lerp(
      GAMESTATE.camera.pitch,
      GAMESTATE.camera.targetPitch,
        CONFIG.ROTATION_LERP
    );

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
      console.log("Socket not ready, retrying in 100ms");
      setTimeout(() => this.updateMovementKeybinds(), 100);
      return;
    }
    this.wsocket.send(JSON.stringify({
      type: "UPDATE_PLAYER_KEYBINDS",
      name: localStorage.getItem("username"),
      movement: {
        forward: this.forward,
        side: this.side,
        speed: this.currentSpeed,
        isJumping: this.isJumping,
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
