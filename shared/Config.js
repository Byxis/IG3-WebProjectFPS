import * as THREE from "https://cdn.skypack.dev/three@0.139.2";
export const CONFIG = {
  // Player movement settings
  WALK_SPEED: 4.0,
  SPRINT_SPEED: 8.0,
  MOUSE_SENSITIVITY: 0.0008,
  //Jump physics settings
  JUMP_FORCE: 7,
  GRAVITY: 20,
  GROUND_LEVEL: 0,
  // Camera configuration
  FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  CAMERA_HEIGHT: 1.0,
  // Smoothing movement
  MOVEMENT_LERP: 0.1,
  ROTATION_LERP: 0.3,
  // Player settings
  STARTING_HEALTH: 100,
  STARTING_AMMO: 30,
  MAX_AMMO: 30,
  RELOAD_TIME: 3000,
  // Combat settings
  BASE_DAMAGE: 25,
  DAMAGE_FALLOFF_START: 10,
  DAMAGE_FALLOFF_END: 50,
  MIN_DAMAGE_PERCENT: 0.4,
};
export const GAMESTATE = {
  // Key States (pressed or not)
  keyStates: {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    ShiftLeft: false,
    Space: false,
    KeyR: false,
  },
  // Physics state
  physics: {
    velocity: new THREE.Vector3(),
    verticalVelocity: 0,
    isJumping: false,
    groundLevel: 0,
    lastTime: 0,
  },
  // Camera state
  camera: {
    pitch: 0,
    targetPitch: 0,
    targetRotationY: 0,
  },
};
export const playerList = [];
